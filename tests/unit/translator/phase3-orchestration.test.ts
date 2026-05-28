import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { BlueprintIR } from "../../../src/translator/ir.js";
import { generateTeamsYaml } from "../../../src/translator/adapters/teams-yaml.js";
import { generateChainsYaml } from "../../../src/translator/adapters/chains-yaml.js";
import { generateMemoryConfig, getMemoryDirectories } from "../../../src/translator/adapters/memory.js";
import { ClaudeAdapter } from "../../../src/translator/adapters/claude.js";
import { PIAdapter } from "../../../src/translator/adapters/pi.js";

function createTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "bp-orch-test-"));
}

function cleanDir(dir: string): void {
  fs.rmSync(dir, { recursive: true, force: true });
}

function createBasicIR(): BlueprintIR {
  return {
    version: "2.0",
    spatial_anchor: {
      project_name: "Test Orchestration",
      surface: "# Test\n\n- Conv1",
      temporal_anchor: "development",
      conventions: ["Conv1"],
    },
    personas: [{ name: "Executor", role: "Agent", reasoning_style: "logical", constraints: [] }],
    rules: [],
    skills: [],
    hooks: [],
    meta: {
      rule_precedence: [],
      conflict_resolution: "precedence-based",
      source_backend: "pi",
      target_backend: "pi",
    },
  };
}

describe("Teams YAML Generator", () => {
  it("should generate empty teams when none defined", () => {
    const ir = createBasicIR();
    const yaml = generateTeamsYaml(ir);
    expect(yaml).toContain("No agent teams defined");
  });

  it("should generate basic team list", () => {
    const ir = createBasicIR();
    ir.orchestration = {
      agent_teams: [
        { team_name: "frontend", agents: ["ui_agent", "ux_agent"] },
        { team_name: "backend", agents: ["api_agent"] },
      ],
    };
    const yaml = generateTeamsYaml(ir);
    expect(yaml).toContain("frontend");
    expect(yaml).toContain("backend");
    expect(yaml).toContain("ui_agent");
  });

  it("should include rich metadata when present", () => {
    const ir = createBasicIR();
    ir.orchestration = {
      agent_teams: [
        {
          team_name: "rich_team",
          agents: ["agent1"],
          owner: "alice@example.com",
          purpose: "Handles data processing",
          risk_tier: "high",
          eval_status: "certified",
          version: "1.0.0",
          capabilities: ["nlp", "clustering"],
        },
      ],
    };
    const yaml = generateTeamsYaml(ir);
    expect(yaml).toContain("owner: alice@example.com");
    expect(yaml).toContain("purpose: Handles data processing");
    expect(yaml).toContain("risk_tier: high");
    expect(yaml).toContain("eval_status: certified");
    expect(yaml).toContain("version: 1.0.0");
    expect(yaml).toContain("nlp");
  });
});

describe("Chains YAML Generator", () => {
  it("should generate empty chains when none defined", () => {
    const ir = createBasicIR();
    const yaml = generateChainsYaml(ir);
    expect(yaml).toContain("No agent chains defined");
  });

  it("should generate sequential chain", () => {
    const ir = createBasicIR();
    ir.orchestration = {
      agent_chains: [
        {
          chain_name: "process_flow",
          sequence: ["parser", "analyzer", "validator"],
          parallel_mode: false,
        },
      ],
    };
    const yaml = generateChainsYaml(ir);
    expect(yaml).toContain("process_flow");
    expect(yaml).not.toContain("parallel_mode: true");
  });

  it("should generate parallel chain with advanced fields", () => {
    const ir = createBasicIR();
    ir.orchestration = {
      agent_chains: [
        {
          chain_name: "complex_chain",
          sequence: ["worker1", "worker2", "aggregator"],
          parallel_mode: true,
          state_schema: "ProcessState",
          error_handler: "error_agent",
          timeout_ms: 30000,
          retry_policy: { max_retries: 3, backoff_ms: 1000 },
        },
      ],
    };
    const yaml = generateChainsYaml(ir);
    expect(yaml).toContain("parallel: true");
    expect(yaml).toContain("state_schema: ProcessState");
    expect(yaml).toContain("error_handler: error_agent");
    expect(yaml).toContain("timeout_ms: 30000");
    expect(yaml).toContain("max_retries: 3");
  });
});

describe("Memory Config Generator", () => {
  it("should generate disabled config when memory not enabled", () => {
    const ir = createBasicIR();
    const yaml = generateMemoryConfig(ir);
    expect(yaml).toContain("enabled: false");
  });

  it("should generate basic memory config when enabled", () => {
    const ir = createBasicIR();
    ir.orchestration = {
      persistent_memory: { enabled: true },
    };
    const yaml = generateMemoryConfig(ir);
    expect(yaml).toContain("enabled: true");
  });

  it("should include all governance fields", () => {
    const ir = createBasicIR();
    ir.orchestration = {
      persistent_memory: {
        enabled: true,
        directory: "memory",
        retention_policy: "90days",
        schema_validation: true,
        encryption: true,
        access_control: ["admin", "owner"],
      },
    };
    const yaml = generateMemoryConfig(ir);
    expect(yaml).toContain("directory: memory");
    expect(yaml).toContain("retention_policy: 90days");
    expect(yaml).toContain("schema_validation: true");
    expect(yaml).toContain("encryption: true");
    expect(yaml).toContain("admin");
    expect(yaml).toContain("owner");
  });
});

describe("Memory Directories Generator", () => {
  it("should return empty list when memory disabled", () => {
    const ir = createBasicIR();
    const tmpDir = createTmpDir();
    try {
      const dirs = getMemoryDirectories(ir, tmpDir);
      expect(dirs).toEqual([]);
    } finally {
      cleanDir(tmpDir);
    }
  });

  it("should create directories for teams when memory enabled", () => {
    const ir = createBasicIR();
    ir.orchestration = {
      persistent_memory: { enabled: true, directory: "memory" },
      agent_teams: [
        { team_name: "team1", agents: ["agent1"] },
        { team_name: "team2", agents: ["agent2"] },
      ],
    };
    const tmpDir = createTmpDir();
    try {
      const dirs = getMemoryDirectories(ir, tmpDir);
      expect(dirs).toContain(path.join(tmpDir, "memory"));
      expect(dirs).toContain(path.join(tmpDir, "memory", "shared"));
      expect(dirs).toContain(path.join(tmpDir, "memory", "agents", "team1"));
      expect(dirs).toContain(path.join(tmpDir, "memory", "agents", "team2"));
    } finally {
      cleanDir(tmpDir);
    }
  });
});

describe("Claude Adapter Orchestration", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = createTmpDir();
  });

  afterEach(() => {
    cleanDir(tmpDir);
  });

  it("should render memory config when enabled", async () => {
    const adapter = new ClaudeAdapter();
    const ir = createBasicIR();
    ir.orchestration = {
      persistent_memory: { enabled: true, retention_policy: "30days" },
    };

    const written = await adapter.render(ir, tmpDir);

    const memoryPath = path.join(tmpDir, ".claude", "memory", "memory.yaml");
    expect(written).toContain(memoryPath);
    expect(fs.existsSync(memoryPath)).toBe(true);
  });

  it("should render agent registry when defined", async () => {
    const adapter = new ClaudeAdapter();
    const ir = createBasicIR();
    ir.agent_registry = {
      agents: [
        {
          name: "analyzer",
          owner: "team-data",
          purpose: "Analyzes datasets",
          risk_tier: "medium",
          eval_status: "tested",
          version: "2.0.1",
        },
      ],
    };

    const written = await adapter.render(ir, tmpDir);

    const registryPath = path.join(tmpDir, ".claude", "agents", "registry.yaml");
    expect(written).toContain(registryPath);
    expect(fs.existsSync(registryPath)).toBe(true);

    const content = fs.readFileSync(registryPath, "utf-8");
    expect(content).toContain("analyzer");
    expect(content).toContain("team-data");
  });
});

describe("PI Adapter Orchestration", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = createTmpDir();
  });

  afterEach(() => {
    cleanDir(tmpDir);
  });

  it("should render teams.yaml using shared generator", async () => {
    const adapter = new PIAdapter();
    const ir = createBasicIR();
    ir.orchestration = {
      agent_teams: [
        {
          team_name: "execution",
          agents: ["executor", "validator"],
          owner: "ops",
          purpose: "Executes workflows",
        },
      ],
    };

    const written = await adapter.render(ir, tmpDir);

    const teamsPath = path.join(tmpDir, "teams.yaml");
    expect(written).toContain(teamsPath);
    expect(fs.existsSync(teamsPath)).toBe(true);

    const content = fs.readFileSync(teamsPath, "utf-8");
    expect(content).toContain("execution");
    expect(content).toContain("owner: ops");
  });

  it("should render chains.yaml using shared generator", async () => {
    const adapter = new PIAdapter();
    const ir = createBasicIR();
    ir.orchestration = {
      agent_chains: [
        {
          chain_name: "main_flow",
          sequence: ["start", "process", "end"],
          parallel_mode: false,
          timeout_ms: 60000,
        },
      ],
    };

    const written = await adapter.render(ir, tmpDir);

    const chainsPath = path.join(tmpDir, "chains.yaml");
    expect(written).toContain(chainsPath);
    expect(fs.existsSync(chainsPath)).toBe(true);

    const content = fs.readFileSync(chainsPath, "utf-8");
    expect(content).toContain("main_flow");
    expect(content).toContain("timeout_ms: 60000");
  });
});

describe("AGENTS.md Orchestration Sections", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = createTmpDir();
  });

  afterEach(() => {
    cleanDir(tmpDir);
  });

  it("should include agent registry table in AGENTS.md", async () => {
    const adapter = new ClaudeAdapter();
    const ir = createBasicIR();
    ir.agent_registry = {
      agents: [
        {
          name: "worker",
          owner: "team-a",
          purpose: "Processes data",
          risk_tier: "low",
          eval_status: "certified",
        },
      ],
    };

    await adapter.render(ir, tmpDir);

    const agentsMDPath = path.join(tmpDir, "AGENTS.md");
    const content = fs.readFileSync(agentsMDPath, "utf-8");
    expect(content).toContain("Agent Registry");
    expect(content).toContain("worker");
    expect(content).toContain("team-a");
    expect(content).toContain("Processes data");
  });

  it("should include MCP servers section when defined", async () => {
    const adapter = new ClaudeAdapter();
    const ir = createBasicIR();
    ir.mcp_servers = [
      {
        name: "filesystem",
        endpoint: "@modelcontextprotocol/server-filesystem",
        risk_level: "low",
      },
    ];

    await adapter.render(ir, tmpDir);

    const agentsMDPath = path.join(tmpDir, "AGENTS.md");
    const content = fs.readFileSync(agentsMDPath, "utf-8");
    expect(content).toContain("MCP Servers");
    expect(content).toContain("filesystem");
  });

  it("should include cross-agent communication when defined", async () => {
    const adapter = new ClaudeAdapter();
    const ir = createBasicIR();
    ir.orchestration = {
      cross_agent_communication: {
        communication_protocol: "broadcast",
        inter_agent_validation: true,
      },
    };

    await adapter.render(ir, tmpDir);

    const agentsMDPath = path.join(tmpDir, "AGENTS.md");
    const content = fs.readFileSync(agentsMDPath, "utf-8");
    expect(content).toContain("Cross-Agent Communication");
    expect(content).toContain("broadcast");
  });
});
