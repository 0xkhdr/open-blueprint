import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderDashboard, revalidate } from "../../../src/dx/dev-server.js";
import type { DevServerState } from "../../../src/dx/dev-server.js";

const mockState: DevServerState = {
  project_name: "my-project",
  backend: "claude",
  risk_tier: "medium",
  rules_count: 5,
  skills_count: 3,
  agents_count: 2,
  validation_status: "passing",
  last_validated: "2026-05-29T12:00:00.000Z",
  errors: [],
};

describe("renderDashboard", () => {
  it("includes project name in title", () => {
    const html = renderDashboard(mockState);
    expect(html).toContain("my-project");
  });

  it("includes backend info", () => {
    const html = renderDashboard(mockState);
    expect(html).toContain("claude");
  });

  it("includes risk tier", () => {
    const html = renderDashboard(mockState);
    expect(html).toContain("medium");
  });

  it("shows rule count", () => {
    const html = renderDashboard(mockState);
    expect(html).toContain("5");
  });

  it("shows skill count", () => {
    const html = renderDashboard(mockState);
    expect(html).toContain("3");
  });

  it("shows agent count", () => {
    const html = renderDashboard(mockState);
    expect(html).toContain("2");
  });

  it("shows passing status with correct class", () => {
    const html = renderDashboard(mockState);
    expect(html).toContain("status-passing");
    expect(html).toContain("PASSING");
  });

  it("shows warning status for warning state", () => {
    const warningState: DevServerState = { ...mockState, validation_status: "warning" };
    const html = renderDashboard(warningState);
    expect(html).toContain("status-warning");
    expect(html).toContain("WARNING");
  });

  it("shows error status for error state", () => {
    const errorState: DevServerState = { ...mockState, validation_status: "error" };
    const html = renderDashboard(errorState);
    expect(html).toContain("status-error");
    expect(html).toContain("ERROR");
  });

  it("returns valid HTML structure", () => {
    const html = renderDashboard(mockState);
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("<html>");
    expect(html).toContain("</html>");
    expect(html).toContain("<body>");
    expect(html).toContain("</body>");
  });

  it("has dark theme background", () => {
    const html = renderDashboard(mockState);
    expect(html).toContain("#0f172a");
  });

  it("includes auto-refresh script", () => {
    const html = renderDashboard(mockState);
    expect(html).toContain("/api/state");
    expect(html).toContain("5000");
  });

  it("shows errors section when errors exist", () => {
    const stateWithErrors: DevServerState = {
      ...mockState,
      validation_status: "error",
      errors: [{ file: "CLAUDE.md", message: "Missing required field", severity: "error" }],
    };
    const html = renderDashboard(stateWithErrors);
    expect(html).toContain("CLAUDE.md");
    expect(html).toContain("Missing required field");
    expect(html).toContain("Issues (1)");
  });

  it("omits errors section when no errors", () => {
    const html = renderDashboard(mockState);
    expect(html).not.toContain("Issues (");
  });

  it("includes refresh button", () => {
    const html = renderDashboard(mockState);
    expect(html).toContain("Refresh");
    expect(html).toContain("location.reload()");
  });
});

describe("revalidate", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "bp-dx-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns state with project_name from directory basename", async () => {
    const state = await revalidate(tmpDir);
    expect(state.project_name).toBe(path.basename(tmpDir));
  });

  it("returns zero counts for empty project", async () => {
    const state = await revalidate(tmpDir);
    expect(state.rules_count).toBe(0);
    expect(state.skills_count).toBe(0);
    expect(state.agents_count).toBe(0);
  });

  it("counts .md files in .claude/rules", async () => {
    const rulesDir = path.join(tmpDir, ".claude", "rules");
    fs.mkdirSync(rulesDir, { recursive: true });
    fs.writeFileSync(path.join(rulesDir, "rule-1.md"), "# Rule 1");
    fs.writeFileSync(path.join(rulesDir, "rule-2.md"), "# Rule 2");
    fs.writeFileSync(path.join(rulesDir, "not-md.txt"), "ignored");

    const state = await revalidate(tmpDir);
    expect(state.rules_count).toBe(2);
  });

  it("counts .md files in .claude/skills", async () => {
    const skillsDir = path.join(tmpDir, ".claude", "skills");
    fs.mkdirSync(skillsDir, { recursive: true });
    fs.writeFileSync(path.join(skillsDir, "skill-1.md"), "# Skill 1");

    const state = await revalidate(tmpDir);
    expect(state.skills_count).toBe(1);
  });

  it("counts .md files in .claude/agents", async () => {
    const agentsDir = path.join(tmpDir, ".claude", "agents");
    fs.mkdirSync(agentsDir, { recursive: true });
    fs.writeFileSync(path.join(agentsDir, "agent-1.md"), "# Agent 1");
    fs.writeFileSync(path.join(agentsDir, "agent-2.md"), "# Agent 2");
    fs.writeFileSync(path.join(agentsDir, "agent-3.md"), "# Agent 3");

    const state = await revalidate(tmpDir);
    expect(state.agents_count).toBe(3);
  });

  it("includes last_validated timestamp", async () => {
    const before = new Date().toISOString();
    const state = await revalidate(tmpDir);
    const after = new Date().toISOString();
    expect(state.last_validated >= before).toBe(true);
    expect(state.last_validated <= after).toBe(true);
  });

  it("returns valid validation_status", async () => {
    const state = await revalidate(tmpDir);
    expect(["passing", "warning", "error"]).toContain(state.validation_status);
  });

  it("errors array is always an array", async () => {
    const state = await revalidate(tmpDir);
    expect(Array.isArray(state.errors)).toBe(true);
  });
});
