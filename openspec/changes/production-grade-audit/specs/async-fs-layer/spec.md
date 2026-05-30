## ADDED Requirements

### Requirement: detect() is fully async using fs/promises
The `detect()` function in `src/detector/index.ts` SHALL use `import { readFile, readdir, access, stat } from 'node:fs/promises'` exclusively. No `fs.*Sync` calls SHALL remain in `detect()` or any function it calls. Independent file reads SHALL be batched with `Promise.all`.

#### Scenario: detect() does not block event loop
- **WHEN** `detect(cwd)` is called concurrently with other async operations
- **THEN** the event loop SHALL remain unblocked while file I/O is in flight

#### Scenario: Independent reads parallelized
- **WHEN** `detect()` reads multiple independent files (e.g., `package.json`, `.gitignore`, `tsconfig.json`)
- **THEN** it SHALL issue those reads in parallel via `Promise.all` rather than sequentially

#### Scenario: Async detect() returns same shape as sync
- **WHEN** `detect(cwd)` resolves
- **THEN** the returned `Fingerprint` object SHALL have the same schema as the prior sync implementation

### Requirement: scanDirectoryTopology() is fully async
The `scanDirectoryTopology()` helper SHALL use `readdir` and `stat` from `node:fs/promises`. No `readdirSync` or `statSync` calls SHALL remain.

#### Scenario: Directory scan does not block event loop
- **WHEN** `scanDirectoryTopology()` is called on a large directory tree
- **THEN** it SHALL not block the event loop between directory entries

### Requirement: No fs.*Sync calls remain in src/detector/ or src/validator/ cache paths
A lint rule or CI check SHALL assert that `fs.readFileSync`, `fs.readdirSync`, `fs.accessSync`, `fs.statSync`, `fs.existsSync` do not appear in `src/detector/index.ts` or the cache-read paths of `src/validator/index.ts`.

#### Scenario: Sync FS call detected in CI
- **WHEN** a PR introduces a `readFileSync` call in `src/detector/index.ts`
- **THEN** the CI lint check SHALL fail and block the merge
