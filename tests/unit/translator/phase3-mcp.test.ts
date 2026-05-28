import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { BlueprintIR } from "../../../src/translator/ir.js";
import { generateMCPJson } from "../../../src/translator/adapters/mcp-json.js";
import { ClaudeAdapter } from "../../../src/translator/adapters/claude.js";
import { CursorAdapter } from "../../../src/translator/adapters/cursor.js";

function createTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "bp-mcp-test-"));
}

function cleanDir(dir: string): void {
  fs.rmSync(dir, { recursive: true, force: true });
}

function createBasicIR(): BlueprintIR {
  return {
    version: "2.0",
    spatial_anchor: {
      project_name: "Test MCP",
      surface: "# Test\n\n- Convention 1",
      temporal_anchor: "development",
      conventions: ["Convention 1"],
    },
    personas: [{ name: "TestAgent", role: "Tester", reasoning_style: "logical", constraints: [] }],
    rules: [],
    skills: [],
    hooks: [],
    meta: {
      rule_precedence: [],
      conflict_resolution: "precedence-based",
      source_backend: "claude",
      target_backend: "claude",
    },
  };
}

describe("MCP JSON Generator", () => {
  it("should generate empty mcpServers for no MCP servers", () => {
    const ir = createBasicIR();
    const json = generateMCPJson(ir);
    const parsed = JSON.parse(json);
    expect(parsed.mcpServers).toEqual({});
  });

  it("should generate basic MCP server config", () => {
    const ir = createBasicIR();
    ir.mcp_servers = [{ name: "test-server", endpoint: "@example/server" }];
    const json = generateMCPJson(ir);
    const parsed = JSON.parse(json);
    expect(parsed.mcpServers["test-server"]).toBeDefined();
    expect(parsed.mcpServers["test-server"].command).toBe("npx");
    expect(parsed.mcpServers["test-server"].args).toEqual(["-y", "@example/server"]);
  });

  it("should include auth_scope as env vars", () => {
    const ir = createBasicIR();
    ir.mcp_servers = [{ name: "github", endpoint: "@modelcontextprotocol/server-github", auth_scope: ["GH_TOKEN"] }];
    const json = generateMCPJson(ir);
    const parsed = JSON.parse(json);
    expect(parsed.mcpServers.github.env).toBeDefined();
    expect(parsed.mcpServers.github.env.GH_TOKEN).toBe("<GH_TOKEN>");
  });

  it("should include governance fields when present", () => {
    const ir = createBasicIR();
    ir.mcp_servers = [
      {
        name: "secure-server",
        endpoint: "@example/secure",
        governance: {
          permission_validation: true,
          auto_approve: ["tool1"],
          require_confirmation: ["admin_tool"],
        },
      },
    ];
    const json = generateMCPJson(ir);
    const parsed = JSON.parse(json);
    expect(parsed.mcpServers["secure-server"].permission_validation).toBe(true);
    expect(parsed.mcpServers["secure-server"].auto_approve).toEqual(["tool1"]);
    expect(parsed.mcpServers["secure-server"].require_confirmation).toEqual(["admin_tool"]);
  });

  it("should include tool registry when present", () => {
    const ir = createBasicIR();
    ir.mcp_servers = [
      {
        name: "tools-server",
        endpoint: "@example/tools",
        tool_registry: [
          { tool_name: "public_tool", server_name: "tools-server", access_level: "public" },
          { tool_name: "admin_tool", server_name: "tools-server", access_level: "admin", auth_scopes: ["ADMIN_KEY"] },
        ],
      },
    ];
    const json = generateMCPJson(ir);
    const parsed = JSON.parse(json);
    expect(parsed.mcpServers["tools-server"].tool_registry).toHaveLength(2);
    expect(parsed.mcpServers["tools-server"].tool_registry[0].name).toBe("public_tool");
    expect(parsed.mcpServers["tools-server"].tool_registry[1].auth_scopes).toEqual(["ADMIN_KEY"]);
  });
});

describe("Claude Adapter MCP", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = createTmpDir();
  });

  afterEach(() => {
    cleanDir(tmpDir);
  });

  it("should parse mcp.json if present", async () => {
    const claudeDir = path.join(tmpDir, ".claude");
    fs.mkdirSync(claudeDir, { recursive: true });
    fs.mkdirSync(path.join(claudeDir, "agents"), { recursive: true });

    const mcpJson = {
      mcpServers: {
        github: {
          command: "npx",
          args: ["-y", "@modelcontextprotocol/server-github"],
          env: { GH_TOKEN: "<GH_TOKEN>" },
        },
      },
    };
    fs.writeFileSync(path.join(claudeDir, "mcp.json"), JSON.stringify(mcpJson), "utf-8");

    const adapter = new ClaudeAdapter();
    const ir = await adapter.parse(tmpDir);

    expect(ir.mcp_servers).toBeDefined();
    expect(ir.mcp_servers?.length).toBe(1);
    expect(ir.mcp_servers?.[0].name).toBe("github");
    expect(ir.mcp_servers?.[0].endpoint).toBe("@modelcontextprotocol/server-github");
  });

  it("should render mcp.json when servers defined", async () => {
    const adapter = new ClaudeAdapter();
    const ir = createBasicIR();
    ir.mcp_servers = [{ name: "test", endpoint: "@test/server" }];

    const written = await adapter.render(ir, tmpDir);

    const mcpPath = path.join(tmpDir, ".claude", "mcp.json");
    expect(written).toContain(mcpPath);
    expect(fs.existsSync(mcpPath)).toBe(true);

    const content = fs.readFileSync(mcpPath, "utf-8");
    const parsed = JSON.parse(content);
    expect(parsed.mcpServers.test).toBeDefined();
  });
});

describe("Cursor Adapter MCP", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = createTmpDir();
  });

  afterEach(() => {
    cleanDir(tmpDir);
  });

  it("should render mcp.json to .cursor directory", async () => {
    const adapter = new CursorAdapter();
    const ir = createBasicIR();
    ir.mcp_servers = [{ name: "github", endpoint: "@modelcontextprotocol/server-github", risk_level: "medium" }];

    const written = await adapter.render(ir, tmpDir);

    const mcpPath = path.join(tmpDir, ".cursor", "mcp.json");
    expect(written).toContain(mcpPath);
    expect(fs.existsSync(mcpPath)).toBe(true);

    const content = fs.readFileSync(mcpPath, "utf-8");
    const parsed = JSON.parse(content);
    expect(parsed.mcpServers.github).toBeDefined();
  });
});
