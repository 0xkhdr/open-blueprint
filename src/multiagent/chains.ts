export interface ChainStep {
  agent: string;
  action: string;
  input_from?: string;
  timeout_ms?: number;
  retry?: { max_retries: number; backoff_ms: number };
}

export interface ChainConfig {
  name: string;
  steps: ChainStep[];
  parallel_mode?: boolean | undefined;
  error_handler?: string | undefined;
}

export interface ChainValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateChainDAG(chain: ChainConfig): ChainValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const graph = new Map<string, string[]>();
  const agents = new Set<string>();
  const actions = new Set<string>();

  for (let i = 0; i < chain.steps.length; i++) {
    const step = chain.steps[i];
    if (!step) continue;
    agents.add(step.agent);
    actions.add(step.action);

    if (step.input_from) {
      const prevStep = chain.steps.find((s) => s.action === step.input_from);
      if (!prevStep) {
        errors.push(`Step ${i} (${step.action}): unresolved input reference '${step.input_from}'`);
      } else {
        graph.set(step.agent, [...(graph.get(step.agent) ?? []), prevStep.agent]);
      }
    }
  }

  // Cycle detection (DFS)
  const visited = new Set<string>();
  const recStack = new Set<string>();

  function hasCycle(node: string): boolean {
    visited.add(node);
    recStack.add(node);
    for (const neighbor of graph.get(node) ?? []) {
      if (!visited.has(neighbor) && hasCycle(neighbor)) return true;
      if (recStack.has(neighbor)) return true;
    }
    recStack.delete(node);
    return false;
  }

  for (const agent of agents) {
    if (!visited.has(agent) && hasCycle(agent)) {
      errors.push(`Circular dependency detected involving agent: ${agent}`);
    }
  }

  if (chain.steps.length === 0) {
    warnings.push("Chain has no steps");
  }

  if (!chain.parallel_mode && agents.size < chain.steps.length) {
    warnings.push("Same agent appears in multiple steps — consider parallel_mode");
  }

  return { valid: errors.length === 0, errors, warnings };
}

export function fromIRChain(irChain: {
  chain_name: string;
  sequence: string[];
  parallel_mode?: boolean | undefined;
  error_handler?: string | undefined;
  timeout_ms?: number | undefined;
  retry_policy?: { max_retries: number; backoff_ms: number } | undefined;
}): ChainConfig {
  const config: ChainConfig = {
    name: irChain.chain_name,
    steps: irChain.sequence.map((agent, i) => ({
      agent,
      action: `step_${i}`,
    })),
  };
  if (irChain.parallel_mode !== undefined) config.parallel_mode = irChain.parallel_mode;
  if (irChain.error_handler !== undefined) config.error_handler = irChain.error_handler;
  return config;
}
