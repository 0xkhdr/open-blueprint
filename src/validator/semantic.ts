import * as fs from "node:fs";
import * as path from "node:path";
import fg from "fast-glob";
import matter from "gray-matter";
import type { BackendManifest } from "../templater/selector.js";
import type { ValidationError } from "./structural.js";

// ---------------------------------------------------------------------------
// Known agentic tool names (Claude Code tool surface)
// ---------------------------------------------------------------------------
const KNOWN_TOOLS = new Set([
  "bash",
  "computer",
  "edit",
  "glob",
  "grep",
  "ls",
  "mcp",
  "mkdir",
  "move_file",
  "multiedit",
  "notebook_edit",
  "notebook_read",
  "read",
  "screenshot_tool",
  "search_files",
  "task",
  "todo_read",
  "todo_write",
  "web_fetch",
  "web_search",
  "write",
  // Cursor tool names
  "cursor_tools",
  "codebase_search",
  "read_file",
  "run_terminal_cmd",
  "list_dir",
  "file_search",
  "delete_file",
  "reapply",
  "edit_file",
  "parallel_apply",
  "grep_search",
  // Generic / OpenDev
  "file_read",
  "file_write",
  "terminal",
  "search",
]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readFileSafe(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, "utf-8");
  } catch {
    return null;
  }
}

interface ParsedFrontmatter {
  data: Record<string, unknown>;
  content: string;
}

function parseFrontmatter(content: string): ParsedFrontmatter | null {
  try {
    const parsed = matter(content);
    const data = parsed.data || {};
    const fm: Record<string, unknown> = Object.create(null);
    if (typeof data === "object" && data !== null) {
      for (const [k, v] of Object.entries(data)) {
        if (k !== "__proto__" && k !== "constructor") {
          fm[k] = v;
        }
      }
    }
    return { data: fm, content: parsed.content };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Check 1: Scope pattern resolution (warn if glob matches 0 files)
// ---------------------------------------------------------------------------

async function checkScopePatterns(
  filePath: string,
  projectRoot: string,
  content: string
): Promise<ValidationError[]> {
  const errors: ValidationError[] = [];
  const parsed = parseFrontmatter(content);
  if (!parsed) return errors;

  const scopeRaw = parsed.data.scope;
  if (typeof scopeRaw !== "string" || !scopeRaw.trim()) return errors;

  const scope = scopeRaw.trim();

  // Resolve glob relative to project root
  try {
    const matches = await fg(scope, {
      cwd: projectRoot,
      onlyFiles: true,
      dot: true,
      ignore: ["**/node_modules/**", "**/dist/**", "**/.git/**"],
    });

    if (matches.length === 0) {
      errors.push({
        file: filePath,
        type: "ZERO_MATCH_SCOPE",
        severity: "warning",
        message: `Scope pattern "${scope}" matches no files in the project`,
        resolution: `Update the scope glob to match existing files, or remove the rule if it's no longer applicable`,
      });
    }
  } catch (e) {
    errors.push({
      file: filePath,
      type: "INVALID_SCOPE_PATTERN",
      severity: "error",
      message: `Scope pattern "${scope}" is not a valid glob: ${e instanceof Error ? e.message : String(e)}`,
      resolution: "Fix the glob pattern syntax in the scope field",
    });
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Check 2 & 3: Tool reference validation
// ---------------------------------------------------------------------------

function checkToolReferences(filePath: string, content: string): ValidationError[] {
  const errors: ValidationError[] = [];
  const parsed = parseFrontmatter(content);
  if (!parsed) return errors;

  const checkTools = (fieldName: string, value: unknown): void => {
    if (!Array.isArray(value)) return;
    for (const tool of value) {
      if (typeof tool === "string" && !KNOWN_TOOLS.has(tool)) {
        errors.push({
          file: filePath,
          type: "UNKNOWN_TOOL_REFERENCE",
          severity: "warning",
          message: `"${fieldName}" references unknown tool: "${tool}"`,
          resolution: `Valid tools: ${[...KNOWN_TOOLS].slice(0, 8).join(", ")}, ... — check spelling or add to allowlist`,
        });
      }
    }
  };

  checkTools("tools_required", parsed.data.tools_required);
  checkTools("allowed_tools", parsed.data.allowed_tools);

  return errors;
}

// ---------------------------------------------------------------------------
// Check 4: Cross-reference integrity (rules referencing skills)
// ---------------------------------------------------------------------------

function checkCrossReferences(
  filePath: string,
  content: string,
  skillsDir: string
): ValidationError[] {
  const errors: ValidationError[] = [];
  const parsed = parseFrontmatter(content);
  if (!parsed) return errors;

  const skillsRaw = parsed.data.skills;
  if (!Array.isArray(skillsRaw)) return errors;

  for (const skillRef of skillsRaw) {
    if (typeof skillRef !== "string") continue;
    // Skill refs can be bare names (e.g. "add-test") or file paths
    const candidatePaths = [path.join(skillsDir, `${skillRef}.md`), path.join(skillsDir, skillRef)];
    const exists = candidatePaths.some((p) => fs.existsSync(p));
    if (!exists) {
      errors.push({
        file: filePath,
        type: "MISSING_SKILL_REFERENCE",
        severity: "error",
        message: `Rule references skill "${skillRef}" which does not exist in ${path.relative(process.cwd(), skillsDir)}`,
        resolution: `Create the skill file or remove the skill reference from this rule's frontmatter`,
      });
    }
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Check 5: Empty rule body
// ---------------------------------------------------------------------------

function checkEmptyBody(filePath: string, content: string): ValidationError | null {
  const parsed = parseFrontmatter(content);
  if (!parsed) return null;

  // If there is frontmatter but body content is whitespace-only
  if (content.startsWith("---") && parsed.content.trim().length === 0) {
    return {
      file: filePath,
      type: "EMPTY_RULE_BODY",
      severity: "warning",
      message: "Rule has frontmatter but no body content (vacuous rule)",
      resolution: "Add descriptive content explaining what this rule requires and why",
    };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface SemanticValidatorOptions {
  projectRoot: string;
  manifest: BackendManifest;
}

export async function validateSemantic(
  files: string[],
  options: SemanticValidatorOptions
): Promise<ValidationError[]> {
  const { projectRoot, manifest } = options;
  const allErrors: ValidationError[] = [];

  // Resolve skills directory
  const skillsGlob = manifest.file_patterns.skills;
  const skillsDir = path.join(projectRoot, path.dirname(skillsGlob.replace(/\*/g, "")));

  for (const filePath of files) {
    if (!filePath.endsWith(".md")) continue;

    const content = readFileSafe(filePath);
    if (!content) continue;

    // Determine file type from path
    const isRule = filePath.includes("/rules/");
    const isSkill = filePath.includes("/skills/");
    const isAgent = filePath.includes("/agents/");

    // Check 1: scope pattern (rules only)
    if (isRule) {
      const scopeErrors = await checkScopePatterns(filePath, projectRoot, content);
      allErrors.push(...scopeErrors);
    }

    // Check 2 & 3: tool references (skills + agents)
    if (isSkill || isAgent) {
      allErrors.push(...checkToolReferences(filePath, content));
    }

    // Check 4: cross-refs (rules only)
    if (isRule) {
      allErrors.push(...checkCrossReferences(filePath, content, skillsDir));
    }

    // Check 5: empty body (rules only)
    if (isRule) {
      const emptyErr = checkEmptyBody(filePath, content);
      if (emptyErr) allErrors.push(emptyErr);
    }
  }

  return allErrors;
}
