import type { BlueprintIR } from "../ir.js";

export function generateChainsYaml(ir: BlueprintIR): string {
  const chains = ir.orchestration?.agent_chains ?? [];

  if (!chains.length) {
    return "# No agent chains defined\nchains: []\n";
  }

  let yaml = "chains:\n";

  for (const chain of chains) {
    yaml += `  - name: ${chain.chain_name}\n`;
    yaml += `    sequence: [${chain.sequence.map((a) => `"${a}"`).join(", ")}]\n`;

    if (chain.parallel_mode) yaml += `    parallel_mode: true\n`;
    if (chain.state_schema) yaml += `    state_schema: "${chain.state_schema}"\n`;
    if (chain.error_handler) yaml += `    error_handler: "${chain.error_handler}"\n`;
    if (chain.timeout_ms) yaml += `    timeout_ms: ${chain.timeout_ms}\n`;

    if (chain.retry_policy) {
      yaml += `    retry_policy:\n`;
      yaml += `      max_retries: ${chain.retry_policy.max_retries}\n`;
      yaml += `      backoff_ms: ${chain.retry_policy.backoff_ms}\n`;
    }
  }

  return yaml;
}
