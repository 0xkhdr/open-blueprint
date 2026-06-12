/**
 * Source generator for `bp dev plugin:scaffold` (Stage 4). Emits a runnable
 * .mjs plugin implementing the docs' rationale-on-hard-rules example.
 */

export const PLUGIN_NAME_RE = /^[a-z0-9_-]+$/i;

export function pluginScaffoldSource(name: string): string {
  return `// ${name} — bp validator plugin (see docs/plugin-api.md).
// Runs during \`bp verify\` against the parsed blueprint. bp loads .mjs/.js
// modules only — if you author in TypeScript, compile it first.
//
// definePlugin is optional sugar: it validates the shape at load time. The
// fallback keeps this plugin runnable in repos where @agentic/bp is not
// installed locally (e.g. when bp runs from a global install).
let definePlugin = (plugin) => plugin;
try {
  ({ definePlugin } = await import("@agentic/bp/plugin"));
} catch {
  // @agentic/bp not resolvable from this file; plain object export still works.
}

export default definePlugin({
  name: "${name}",
  version: "0.1.0",
  validators: [
    {
      id: "require-rationale-on-hard-rules",
      level: "semantic",
      check(ctx) {
        for (const file of ctx.files) {
          if (file.layer !== "rules") continue;
          if (file.frontmatter.severity === "hard" && !file.frontmatter.rationale) {
            ctx.error(
              file.path,
              file.lineOf("severity"),
              "Hard rules must declare a rationale",
              'Add: rationale: "why this constraint exists"'
            );
          }
        }
      },
    },
  ],
});
`;
}
