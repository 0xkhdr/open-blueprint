import * as fs from "node:fs";
import * as http from "node:http";
import * as path from "node:path";
import { detect, enrichFingerprint } from "../detector/index.js";
import { logger } from "../logger.js";
import { resolveTemplatePack } from "../templater/selector.js";
import { runValidator } from "../validator/index.js";

export interface DevServerState {
  project_name: string;
  backend: string;
  risk_tier: string;
  rules_count: number;
  skills_count: number;
  agents_count: number;
  validation_status: "passing" | "warning" | "error";
  last_validated: string;
  errors: Array<{ file: string; message: string; severity: string }>;
}

export async function revalidate(projectRoot: string): Promise<DevServerState> {
  const project_name = path.basename(projectRoot);

  try {
    const fingerprint = await detect(projectRoot);
    const enhanced = enrichFingerprint(fingerprint);
    const backend = "claude";
    const risk_tier = enhanced.risk_tier ?? "low";
    const pack = resolveTemplatePack(fingerprint, backend as any);

    const result = await runValidator({
      level: "all",
      projectRoot,
      manifest: pack.manifest,
      fingerprint,
    });

    const allIssues = [...result.errors, ...result.warnings];
    const hasErrors = result.errors.some((e) => e.severity === "error");
    const hasWarnings = result.warnings.some((w) => w.severity === "warning");

    return {
      project_name,
      backend,
      risk_tier,
      rules_count: countFiles(path.join(projectRoot, ".claude/rules")),
      skills_count: countFiles(path.join(projectRoot, ".claude/skills")),
      agents_count: countFiles(path.join(projectRoot, ".claude/agents")),
      validation_status: hasErrors ? "error" : hasWarnings ? "warning" : "passing",
      last_validated: new Date().toISOString(),
      errors: allIssues.map((e) => ({
        file: path.relative(projectRoot, e.file),
        message: e.message,
        severity: e.severity,
      })),
    };
  } catch {
    return {
      project_name,
      backend: "claude",
      risk_tier: "unknown",
      rules_count: countFiles(path.join(projectRoot, ".claude/rules")),
      skills_count: countFiles(path.join(projectRoot, ".claude/skills")),
      agents_count: countFiles(path.join(projectRoot, ".claude/agents")),
      validation_status: "passing",
      last_validated: new Date().toISOString(),
      errors: [],
    };
  }
}

function countFiles(dir: string): number {
  if (!fs.existsSync(dir)) return 0;
  return fs.readdirSync(dir).filter((f) => f.endsWith(".md")).length;
}

export function renderDashboard(state: DevServerState): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Blueprint Dashboard — ${state.project_name}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #e2e8f0; }
    .container { max-width: 1200px; margin: 0 auto; padding: 2rem; }
    h1 { font-size: 2rem; margin-bottom: 0.5rem; }
    .subtitle { color: #94a3b8; margin-bottom: 2rem; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1rem; margin-bottom: 2rem; }
    .card { background: #1e293b; border-radius: 12px; padding: 1.5rem; border: 1px solid #334155; }
    .card h3 { font-size: 0.875rem; text-transform: uppercase; color: #94a3b8; margin-bottom: 0.5rem; }
    .card .value { font-size: 2rem; font-weight: 700; }
    .status { display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.5rem 1rem; border-radius: 9999px; font-weight: 600; }
    .status-passing { background: rgba(34, 197, 94, 0.2); color: #22c55e; }
    .status-warning { background: rgba(245, 158, 11, 0.2); color: #f59e0b; }
    .status-error { background: rgba(239, 68, 68, 0.2); color: #ef4444; }
    .errors { margin-top: 2rem; }
    .errors h2 { margin-bottom: 1rem; }
    .error-item { background: #1e293b; border-left: 4px solid #ef4444; padding: 1rem; margin-bottom: 0.5rem; border-radius: 0 8px 8px 0; }
    .warn-item { background: #1e293b; border-left: 4px solid #f59e0b; padding: 1rem; margin-bottom: 0.5rem; border-radius: 0 8px 8px 0; }
    .refresh { position: fixed; bottom: 2rem; right: 2rem; background: #3b82f6; color: white; border: none; padding: 1rem 2rem; border-radius: 9999px; cursor: pointer; font-weight: 600; }
    .refresh:hover { background: #2563eb; }
    .timestamp { color: #64748b; font-size: 0.75rem; margin-top: 0.5rem; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🏗️ ${state.project_name}</h1>
    <p class="subtitle">Blueprint Governance Dashboard · Backend: ${state.backend} · Risk: ${state.risk_tier}</p>

    <div class="grid">
      <div class="card">
        <h3>Validation Status</h3>
        <span class="status status-${state.validation_status}">
          ${state.validation_status === "passing" ? "✓" : state.validation_status === "warning" ? "⚠" : "✗"}
          ${state.validation_status.toUpperCase()}
        </span>
        <p class="timestamp">Last checked: ${new Date(state.last_validated).toLocaleTimeString()}</p>
      </div>
      <div class="card">
        <h3>Rules</h3>
        <div class="value">${state.rules_count}</div>
      </div>
      <div class="card">
        <h3>Skills</h3>
        <div class="value">${state.skills_count}</div>
      </div>
      <div class="card">
        <h3>Agents</h3>
        <div class="value">${state.agents_count}</div>
      </div>
    </div>

    ${
      state.errors.length > 0
        ? `<div class="errors">
      <h2>Issues (${state.errors.length})</h2>
      ${state.errors
        .map(
          (e) => `
        <div class="${e.severity === "error" ? "error-item" : "warn-item"}">
          <strong>${e.file}</strong><br>
          ${e.message}
        </div>
      `
        )
        .join("")}
    </div>`
        : ""
    }
  </div>

  <button class="refresh" onclick="location.reload()">🔄 Refresh</button>

  <script>
    const lastValidated = '${state.last_validated}';
    setInterval(() => {
      fetch('/api/state').then(r => r.json()).then(s => {
        if (s.last_validated !== lastValidated) location.reload();
      }).catch(() => {});
    }, 5000);
  </script>
</body>
</html>`;
}

export async function startDevServer(projectRoot: string, port = 3456): Promise<void> {
  let state = await revalidate(projectRoot);

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  const onFileChange = () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async () => {
      state = await revalidate(projectRoot);
    }, 300);
  };

  const claudeDir = path.join(projectRoot, ".claude");
  if (fs.existsSync(claudeDir)) {
    fs.watch(claudeDir, { recursive: true }, (_, filename) => {
      if (filename?.endsWith(".md") || filename?.endsWith(".json")) {
        onFileChange();
      }
    });
  }

  const bpConfig = path.join(projectRoot, ".bp.json");
  if (fs.existsSync(bpConfig)) {
    fs.watch(bpConfig, onFileChange);
  }

  const server = http.createServer(async (req, res) => {
    const url = req.url || "/";

    if (url === "/") {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(renderDashboard(state));
      return;
    }

    if (url === "/api/state") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(state));
      return;
    }

    if (url === "/api/validate") {
      state = await revalidate(projectRoot);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", state }));
      return;
    }

    res.writeHead(404);
    res.end("Not Found");
  });

  server.listen(port, () => {
    logger.info({ port }, "Blueprint dev server running");
  });

  await new Promise<void>((resolve) => {
    process.on("SIGINT", () => {
      server.close();
      resolve();
    });
  });
}
