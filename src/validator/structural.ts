import * as fs from "node:fs";
import matter from "gray-matter";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { scanForSecrets } from "../security/scan.js";
import type { BackendManifest } from "../templater/selector.js";

export interface ValidationError {
  file: string;
  line?: number;
  type: string;
  severity: "error" | "warning" | "info";
  message: string;
  resolution: string;
}

interface FrontmatterSchema {
  required: string[];
  optional: string[];
  severity_values?: string[];
}

function fileType(
  filePath: string,
  manifest: BackendManifest
): "anchor" | "rules" | "skills" | "agents" | "hooks" | null {
  const relative = filePath.replace(/\\/g, "/");
  if (manifest.file_patterns.anchor.some((p) => relative.endsWith(p.replace(/\*/g, ""))))
    return "anchor";
  if (relative.match(/\.claude\/rules\//)) return "rules";
  if (relative.match(/\.claude\/skills\//)) return "skills";
  if (relative.match(/\.claude\/agents\//)) return "agents";
  if (relative.match(/\.claude\/hooks\//)) return "hooks";
  // Generic fallback by directory name
  if (relative.includes("/rules/")) return "rules";
  if (relative.includes("/skills/")) return "skills";
  if (relative.includes("/agents/")) return "agents";
  return null;
}

function checkEncoding(filePath: string): ValidationError | null {
  const buf = fs.readFileSync(filePath);
  // Check for BOM (EF BB BF for UTF-8 BOM)
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    return {
      file: filePath,
      line: 1,
      type: "BOM_DETECTED",
      severity: "error",
      message: "File has UTF-8 BOM prefix",
      resolution: `Remove the BOM: \`sed -i '1s/^\\xef\\xbb\\xbf//' ${filePath}\``,
    };
  }
  // Attempt UTF-8 decode
  try {
    buf.toString("utf-8");
  } catch {
    return {
      file: filePath,
      type: "INVALID_ENCODING",
      severity: "error",
      message: "File is not valid UTF-8",
      resolution: `Re-encode file as UTF-8: iconv -f <current-encoding> -t UTF-8 ${filePath}`,
    };
  }
  return null;
}

function checkFileSize(
  filePath: string,
  ftype: "anchor" | "rules" | "skills" | "agents" | "hooks",
  manifest: BackendManifest
): ValidationError | null {
  const limits = manifest.max_file_sizes;
  const limit: number | undefined =
    ftype === "anchor"
      ? limits.anchor
      : ftype === "rules"
        ? limits.rules
        : ftype === "skills"
          ? limits.skills
          : ftype === "agents"
            ? limits.agents
            : undefined;

  if (limit === undefined) return null;

  const stat = fs.statSync(filePath);
  if (stat.size > limit) {
    return {
      file: filePath,
      type: "FILE_TOO_LARGE",
      severity: "error",
      message: `File size ${stat.size} bytes exceeds limit of ${limit} bytes for type "${ftype}"`,
      resolution: `Reduce file content or split into multiple files. Limit: ${limit} bytes`,
    };
  }
  return null;
}

function checkFrontmatter(
  filePath: string,
  content: string,
  ftype: "anchor" | "rules" | "skills" | "agents" | "hooks"
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (ftype === "anchor" || ftype === "hooks") return errors;

  let parsed: matter.GrayMatterFile<string>;
  try {
    parsed = matter(content);
  } catch (e) {
    errors.push({
      file: filePath,
      line: 1,
      type: "FRONTMATTER_PARSE_ERROR",
      severity: "error",
      message: `Failed to parse YAML frontmatter: ${e instanceof Error ? e.message : String(e)}`,
      resolution: "Ensure frontmatter is valid YAML between --- delimiters at file start",
    });
    return errors;
  }

  const _fm = parsed.data as Record<string, unknown>;
  const hasAnyFrontmatter = content.startsWith("---");

  if (!hasAnyFrontmatter) {
    errors.push({
      file: filePath,
      line: 1,
      type: "MISSING_FRONTMATTER",
      severity: "warning",
      message: `File has no YAML frontmatter`,
      resolution: "Add frontmatter block starting with --- at the top of the file",
    });
    return errors;
  }

  return errors;
}

function checkRequiredFields(
  filePath: string,
  content: string,
  ftype: "anchor" | "rules" | "skills" | "agents" | "hooks",
  manifest: BackendManifest
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (ftype === "anchor" || ftype === "hooks") return errors;

  const schema: FrontmatterSchema | undefined = manifest.frontmatter_schema[
    ftype as keyof typeof manifest.frontmatter_schema
  ] as FrontmatterSchema | undefined;
  if (!schema) return errors;

  if (!content.startsWith("---")) return errors;

  let parsed: matter.GrayMatterFile<string>;
  try {
    parsed = matter(content);
  } catch {
    return errors;
  }

  const fm = parsed.data as Record<string, unknown>;

  for (const required of schema.required) {
    if (fm[required] === undefined || fm[required] === null || fm[required] === "") {
      // Find approximate line number
      const lines = content.split("\n");
      const endFrontmatter = lines.findIndex((l, i) => i > 0 && l.trim() === "---");
      errors.push({
        file: filePath,
        line: endFrontmatter > 0 ? endFrontmatter : 1,
        type: "MISSING_REQUIRED_FIELD",
        severity: "error",
        message: `Required frontmatter field "${required}" is missing or empty`,
        resolution: `Add "${required}: <value>" to the frontmatter block`,
      });
    }
  }

  // Validate severity values for rules
  if (ftype === "rules" && schema.severity_values && fm.severity !== undefined) {
    const sev = String(fm.severity);
    if (!schema.severity_values.includes(sev)) {
      errors.push({
        file: filePath,
        line: 2,
        type: "INVALID_SEVERITY",
        severity: "error",
        message: `Invalid severity value "${sev}". Must be one of: ${schema.severity_values.join(", ")}`,
        resolution: `Change severity to one of: ${schema.severity_values.join(", ")}`,
      });
    }
  }

  return errors;
}

function checkMarkdownWellformedness(filePath: string, content: string): ValidationError[] {
  const errors: ValidationError[] = [];
  const lines = content.split("\n");

  // Check unclosed code fences
  let inFence = false;
  let fenceLine = 0;
  let fenceChar = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const trimmed = line.trim();
    if (!inFence) {
      if (trimmed.startsWith("```") || trimmed.startsWith("~~~")) {
        inFence = true;
        fenceLine = i + 1;
        fenceChar = trimmed.startsWith("```") ? "```" : "~~~";
      }
    } else {
      if (trimmed === fenceChar || (trimmed.startsWith(fenceChar) && trimmed === fenceChar)) {
        inFence = false;
      }
    }
  }

  if (inFence) {
    errors.push({
      file: filePath,
      line: fenceLine,
      type: "UNCLOSED_CODE_FENCE",
      severity: "error",
      message: `Unclosed code fence starting at line ${fenceLine}`,
      resolution: `Add closing ${fenceChar} to end the code block opened at line ${fenceLine}`,
    });
  }

  // Check heading hierarchy (no skipping levels)
  let lastHeadingLevel = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const headingMatch = line.match(/^(#{1,6})\s/);
    if (headingMatch) {
      const level = headingMatch[1]?.length ?? 0;
      if (lastHeadingLevel > 0 && level > lastHeadingLevel + 1) {
        errors.push({
          file: filePath,
          line: i + 1,
          type: "HEADING_HIERARCHY",
          severity: "warning",
          message: `Heading jumps from H${lastHeadingLevel} to H${level} (skipped level)`,
          resolution: `Use H${lastHeadingLevel + 1} instead of H${level}`,
        });
      }
      lastHeadingLevel = level;
    }
  }

  // Parse with remark for deeper checks (broken links, etc.)
  try {
    unified().use(remarkParse).parse(content);
  } catch (e) {
    errors.push({
      file: filePath,
      line: 1,
      type: "MARKDOWN_PARSE_ERROR",
      severity: "warning",
      message: `Markdown parse error: ${e instanceof Error ? e.message : String(e)}`,
      resolution: "Fix malformed markdown syntax",
    });
  }

  return errors;
}

export function validateStructural(filePath: string, manifest: BackendManifest): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!fs.existsSync(filePath)) {
    errors.push({
      file: filePath,
      type: "FILE_NOT_FOUND",
      severity: "error",
      message: `Required file does not exist: ${filePath}`,
      resolution: `Run \`bp init\` to generate missing files, or create the file manually`,
    });
    return errors;
  }

  const encodingError = checkEncoding(filePath);
  if (encodingError) {
    errors.push(encodingError);
    return errors; // Can't proceed if encoding is invalid
  }

  const content = fs.readFileSync(filePath, "utf-8");
  const ftype = fileType(filePath, manifest);

  if (ftype !== null && ftype !== "hooks") {
    const sizeError = checkFileSize(filePath, ftype, manifest);
    if (sizeError) errors.push(sizeError);

    if (filePath.endsWith(".md")) {
      errors.push(...checkFrontmatter(filePath, content, ftype));
      errors.push(...checkRequiredFields(filePath, content, ftype, manifest));
      errors.push(...checkMarkdownWellformedness(filePath, content));
      errors.push(...scanForSecrets(filePath, content));
    }
  }

  return errors;
}

export function validateStructuralBatch(
  files: string[],
  manifest: BackendManifest
): ValidationError[] {
  const allErrors: ValidationError[] = [];
  for (const file of files) {
    const fileErrors = validateStructural(file, manifest);
    allErrors.push(...fileErrors);
  }
  return allErrors;
}
