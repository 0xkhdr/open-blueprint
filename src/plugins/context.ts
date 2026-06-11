/**
 * Plugin execution context — serializable payload, file inventory, and the
 * deep-frozen ValidationContext handed to plugin validators (Stage 4).
 *
 * The payload crosses a structured-clone boundary in `isolated` mode, so it
 * holds plain data only; `lineOf` is reconstructed on the execution side from
 * the serialized field line map.
 */
import * as fsPromises from "node:fs/promises";
import * as path from "node:path";
import matter from "gray-matter";
import picomatch from "picomatch";
import type {
  BlueprintFileInfo,
  BlueprintFileLayer,
  BlueprintIR,
  Fingerprint,
  PluginValidatorLevel,
  ValidationContext,
} from "../plugin/index.js";
import type { BackendManifest } from "../templater/selector.js";

export interface SerializedFileInfo {
  path: string;
  layer: BlueprintFileLayer;
  frontmatter: Record<string, unknown>;
  body: string;
  /** 1-based line numbers of top-level frontmatter fields. */
  fieldLines: Record<string, number>;
}

export interface PluginRunPayload {
  blueprint: BlueprintIR;
  fingerprint?: Fingerprint;
  files: SerializedFileInfo[];
  /** Only validators whose level is listed here run. */
  levels: PluginValidatorLevel[];
}

export interface PluginDiagnostic {
  file: string;
  line?: number;
  severity: "error" | "warning" | "info";
  message: string;
  resolution: string;
  validatorId: string;
}

const PLUGIN_LEVELS: readonly PluginValidatorLevel[] = [
  "structural",
  "semantic",
  "logical",
  "enforcement",
];

/**
 * Map a requested validation level to the plugin validator levels that should
 * run. Structural always runs in the pipeline, so it is always included for
 * plugin-capable levels; drift/governance carry no plugin validators.
 */
export function activePluginLevels(level: string): PluginValidatorLevel[] {
  if (level === "all") return [...PLUGIN_LEVELS];
  if (!PLUGIN_LEVELS.includes(level as PluginValidatorLevel)) return [];
  return level === "structural" ? ["structural"] : ["structural", level as PluginValidatorLevel];
}

/** PLUGIN_<plugin-name>_<validator-id> in upper snake case. */
export function diagnosticType(pluginName: string, validatorId: string): string {
  const upperSnake = (s: string) =>
    s
      .replace(/[^A-Za-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .toUpperCase();
  return `PLUGIN_${upperSnake(pluginName)}_${upperSnake(validatorId)}`;
}

function frontmatterFieldLines(content: string): Record<string, number> {
  const lines = content.split("\n");
  if (lines[0]?.trim() !== "---") return {};
  const fieldLines: Record<string, number> = {};
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (line.trim() === "---") break;
    const match = line.match(/^([A-Za-z0-9_-]+)\s*:/);
    if (match?.[1] && fieldLines[match[1]] === undefined) {
      fieldLines[match[1]] = i + 1; // 1-based
    }
  }
  return fieldLines;
}

function layerMatchers(manifest: BackendManifest): Array<{
  layer: BlueprintFileLayer;
  match: (rel: string) => boolean;
}> {
  const make = (patterns: string[]) => {
    const matchers = patterns.map((p) => picomatch(p, { dot: true }));
    return (rel: string) => matchers.some((m) => m(rel));
  };
  return [
    { layer: "rules", match: make([manifest.file_patterns.rules]) },
    { layer: "skills", match: make([manifest.file_patterns.skills]) },
    { layer: "agents", match: make([manifest.file_patterns.agents]) },
    { layer: "hooks", match: make([manifest.file_patterns.hooks]) },
    { layer: "anchor", match: make(manifest.file_patterns.anchor) },
  ];
}

function classifyLayer(
  rel: string,
  matchers: ReturnType<typeof layerMatchers>
): BlueprintFileLayer {
  for (const { layer, match } of matchers) {
    if (match(rel)) return layer;
  }
  // Fallback for files collected outside manifest patterns.
  if (rel.includes(`${path.sep}rules${path.sep}`)) return "rules";
  if (rel.includes(`${path.sep}skills${path.sep}`)) return "skills";
  if (rel.includes(`${path.sep}agents${path.sep}`)) return "agents";
  if (rel.includes(`${path.sep}hooks${path.sep}`)) return "hooks";
  return "anchor";
}

/**
 * Read and classify blueprint files into the serializable inventory plugins
 * receive. The host reads files once; workers get data, not fs access.
 */
export async function buildFileInventory(
  projectRoot: string,
  manifest: BackendManifest,
  files: string[]
): Promise<SerializedFileInfo[]> {
  const matchers = layerMatchers(manifest);
  const inventory = await Promise.all(
    files.map(async (file): Promise<SerializedFileInfo | null> => {
      let content: string;
      try {
        content = await fsPromises.readFile(file, "utf-8");
      } catch {
        return null;
      }
      const rel = path.relative(projectRoot, file).split(path.sep).join("/");
      let frontmatter: Record<string, unknown> = {};
      let body = content;
      try {
        const parsed = matter(content);
        frontmatter = parsed.data as Record<string, unknown>;
        body = parsed.content;
      } catch {
        // Malformed frontmatter: expose the raw body; structural validation
        // reports the parse error separately.
      }
      return {
        path: file,
        layer: classifyLayer(rel, matchers),
        frontmatter,
        body,
        fieldLines: frontmatterFieldLines(content),
      };
    })
  );
  return inventory.filter((entry): entry is SerializedFileInfo => entry !== null);
}

export function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value as object)) {
      deepFreeze((value as Record<string, unknown>)[key]);
    }
  }
  return value;
}

export interface FrozenContextData {
  blueprint: BlueprintIR;
  fingerprint?: Fingerprint;
  files: ReadonlyArray<BlueprintFileInfo>;
}

/**
 * Deep-freeze the payload data once per plugin run. Callers in inline mode
 * must pass an already-cloned payload so host state is never frozen.
 */
export function prepareContextData(payload: PluginRunPayload): FrozenContextData {
  const blueprint = deepFreeze(payload.blueprint);
  const fingerprint = payload.fingerprint ? deepFreeze(payload.fingerprint) : undefined;
  const files = Object.freeze(
    payload.files.map((f) => {
      const fieldLines = deepFreeze(f.fieldLines);
      return Object.freeze({
        path: f.path,
        layer: f.layer,
        frontmatter: deepFreeze(f.frontmatter),
        body: f.body,
        lineOf: (field: string) => fieldLines[field],
      } satisfies BlueprintFileInfo);
    })
  );
  return { blueprint, files, ...(fingerprint ? { fingerprint } : {}) };
}

/** Build the per-validator context; diagnostics land in `sink` tagged with the validator id. */
export function makeValidationContext(
  data: FrozenContextData,
  validatorId: string,
  sink: PluginDiagnostic[]
): ValidationContext {
  const emit = (
    severity: PluginDiagnostic["severity"],
    file: string,
    line: number | undefined,
    message: string,
    resolution: string
  ) => {
    sink.push({
      file: String(file),
      ...(typeof line === "number" ? { line } : {}),
      severity,
      message: String(message),
      resolution: String(resolution),
      validatorId,
    });
  };
  return Object.freeze({
    blueprint: data.blueprint,
    files: data.files,
    ...(data.fingerprint ? { fingerprint: data.fingerprint } : {}),
    error: (file, line, message, resolution) => emit("error", file, line, message, resolution),
    warn: (file, line, message, resolution) =>
      emit("warning", file, line, message, resolution ?? "Review and address the warning"),
    info: (file, message) =>
      emit("info", file, undefined, message, "Informational; no action required"),
  } satisfies ValidationContext);
}
