## ADDED Requirements

### Requirement: audit.ts uses async I/O with append stream
`src/security/audit.ts` SHALL use `fsPromises` for all file system operations. Directory creation, symlink detection, and log rotation MUST be async. The log append operation SHOULD use a `WriteStream` (append mode) to minimize open/close overhead.

#### Scenario: Audit log write does not block event loop
- **WHEN** `AuditLogger.log()` is called during a high-frequency operation (100+ calls/sec)
- **THEN** the event loop is not blocked (no synchronous `appendFileSync`)
- **THEN** all log entries are written in order

#### Scenario: Audit directory creation is async
- **WHEN** the audit log directory does not exist
- **THEN** `audit.ts` creates it using `fsPromises.mkdir` with `{ recursive: true }`

### Requirement: config/project.ts exposes only async functions
`initProjectConfig` and `saveProjectConfig` SHALL be `async` functions returning `Promise<void>`. Synchronous variants (`fs.readFileSync`, `fs.writeFileSync`, `fs.existsSync`) MUST NOT appear in `src/config/project.ts`.

#### Scenario: initProjectConfig returns a Promise
- **WHEN** `initProjectConfig()` is called
- **THEN** it returns a `Promise` that resolves when the config file is written
- **THEN** callers can `await` it

#### Scenario: loadProjectConfig is async
- **WHEN** `loadProjectConfig()` is called in a context where the config file exists
- **THEN** it returns a `Promise` that resolves with the parsed config object

### Requirement: drift.ts fingerprint I/O is async
All file reads and writes in `src/validator/drift.ts` (fingerprint load, fingerprint save) SHALL use `fsPromises`. `computeSimilarity` is a pure function and remains synchronous.

#### Scenario: Fingerprint load is non-blocking
- **WHEN** `loadFingerprint()` is called
- **THEN** it returns a `Promise` resolved with the parsed fingerprint or `null`

#### Scenario: Fingerprint save is non-blocking
- **WHEN** `saveFingerprint()` is called with a fingerprint object
- **THEN** it returns a `Promise` resolved after the file is written

### Requirement: cache.ts exposes only async variants
`src/validator/cache.ts` SHALL expose async functions only. Any previously synchronous public API (`readCacheSync`, `writeCacheSync`, etc.) MUST be removed or replaced with async equivalents. Internal `fs.*Sync` calls MUST be eliminated.

#### Scenario: Cache read is non-blocking
- **WHEN** `readCache(key)` is called
- **THEN** it returns a `Promise` resolved with the cached value or `undefined`

#### Scenario: Cache write is non-blocking
- **WHEN** `writeCache(key, value)` is called
- **THEN** it returns a `Promise` resolved after the cache entry is persisted

### Requirement: registry/client.ts and registry/signer.ts use async I/O
All `fs.*Sync` calls in `src/registry/client.ts` (`readdirSync`, `cpSync`, `readFileSync`, `writeFileSync`, `mkdirSync`) and `src/registry/signer.ts` (`readdirSync`, `readFileSync`) SHALL be replaced with `fsPromises` equivalents.

#### Scenario: Registry install is async
- **WHEN** `RegistryClient.install(packageName)` is called
- **THEN** it returns a `Promise` that resolves when all files are copied
- **THEN** the event loop is not blocked during file copy

#### Scenario: Key loading in signer is async
- **WHEN** `loadPublicKey()` is called
- **THEN** it returns a `Promise<Buffer>` with the key contents

### Requirement: lsp/server.ts document validation is async
The single `fs.existsSync` call in `src/lsp/server.ts` for project root detection SHALL be replaced with `await fsPromises.access(path)` (or equivalent async existence check).

#### Scenario: LSP server does not block on project root check
- **WHEN** the LSP server receives a document validation request
- **THEN** the project root check uses async I/O
- **THEN** the LSP event loop is not blocked

### Requirement: doctor.ts runs checks concurrently with async I/O
All file system checks in `src/cli/commands/doctor.ts` SHALL use `fsPromises`. Independent checks SHALL be run concurrently via `Promise.all`. The final output SHALL be sorted to ensure deterministic ordering despite concurrent execution.

#### Scenario: Doctor checks run concurrently
- **WHEN** `bp doctor` is run on a large repository
- **THEN** independent checks (config, codex, registry, secret-scan) execute concurrently
- **THEN** total wall time is less than the sum of individual check times

#### Scenario: Doctor output is deterministically ordered
- **WHEN** `bp doctor` completes concurrent checks
- **THEN** results are printed in a consistent, sorted order regardless of completion timing

### Requirement: lint:no-sync-fs covers all source files
The `lint:no-sync-fs` npm script SHALL check ALL TypeScript files matching `src/**/*.ts`, not just the 6 previously listed files. The script MUST exit non-zero if any synchronous `fs` call is found.

#### Scenario: lint:no-sync-fs catches new sync calls
- **WHEN** a developer introduces `fs.readFileSync` in any `src/**/*.ts` file
- **THEN** `npm run lint:no-sync-fs` exits with a non-zero code
- **THEN** CI fails

#### Scenario: lint:no-sync-fs passes on clean codebase
- **WHEN** all sync `fs` calls have been migrated to async
- **THEN** `npm run lint:no-sync-fs` exits with code `0`
