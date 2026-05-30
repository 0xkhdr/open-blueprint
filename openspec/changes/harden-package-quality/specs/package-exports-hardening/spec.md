## ADDED Requirements

### Requirement: Package exposes a single public exports entry
`package.json` SHALL contain an `exports` field with exactly one entry (`"."`) mapping to the CLI entrypoint and its TypeScript declaration file.

#### Scenario: Valid consumer import resolves
- **WHEN** a consumer does `import bp from "@agentic/bp"`
- **THEN** Node.js resolves to `./dist/cli/index.js`

#### Scenario: Internal path import is blocked
- **WHEN** a consumer attempts `import x from "@agentic/bp/dist/validator/index.js"`
- **THEN** Node.js throws `ERR_PACKAGE_PATH_NOT_EXPORTED`

### Requirement: Package declares TypeScript types entry
`package.json` SHALL contain a `types` field pointing to `./dist/cli/index.d.ts` so TypeScript consumers resolve types without additional configuration.

#### Scenario: TypeScript consumer resolves types
- **WHEN** a TypeScript project imports `"@agentic/bp"` with `moduleResolution: "NodeNext"`
- **THEN** the compiler resolves declarations from `./dist/cli/index.d.ts` without error

### Requirement: Package declares sideEffects false
`package.json` SHALL contain `"sideEffects": false` to enable dead-code elimination in bundlers.

#### Scenario: Bundler can tree-shake
- **WHEN** a bundler (e.g., rollup, webpack) processes `@agentic/bp`
- **THEN** it treats all modules as side-effect-free and eliminates unused exports

### Requirement: exports map uses conditional exports for types
The `"."` export entry SHALL include both `"import"` and `"types"` conditions so both runtime and TypeScript tooling resolve correctly.

#### Scenario: Conditional import condition resolves runtime module
- **WHEN** Node.js resolves `"@agentic/bp"` at runtime with the `import` condition
- **THEN** it resolves to `./dist/cli/index.js`

#### Scenario: Conditional types condition resolves declarations
- **WHEN** TypeScript resolves `"@agentic/bp"` with the `types` condition
- **THEN** it resolves to `./dist/cli/index.d.ts`
