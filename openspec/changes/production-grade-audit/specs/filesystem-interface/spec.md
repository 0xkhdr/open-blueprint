## ADDED Requirements

### Requirement: FileSystem interface abstracts fs/promises operations
The system SHALL define a `FileSystem` interface in `src/utils/fs.ts` with the following methods, matching the signatures of their `node:fs/promises` equivalents: `readFile(path, encoding): Promise<string>`, `readdir(path): Promise<string[]>`, `stat(path): Promise<Stats>`, `access(path): Promise<void>`. A `RealFileSystem` class implementing this interface using `node:fs/promises` SHALL be provided as the default implementation.

#### Scenario: RealFileSystem delegates to node:fs/promises
- **WHEN** `new RealFileSystem().readFile('/some/path', 'utf-8')` is called
- **THEN** it SHALL delegate to `import('node:fs/promises').readFile('/some/path', 'utf-8')`

#### Scenario: FileSystem interface is structurally typed
- **WHEN** a test provides an object that satisfies the `FileSystem` interface shape
- **THEN** TypeScript SHALL accept it as a valid `FileSystem` without explicit `implements` declaration

### Requirement: InMemoryFileSystem supports pure unit tests
The system SHALL provide an `InMemoryFileSystem` class in `src/utils/fs.ts` (or `src/utils/fs.test-helpers.ts`) that implements `FileSystem` using an in-memory `Map<string, string>`. It SHALL support `addFile(path, content)` for test setup. `readdir` SHALL return entries from the in-memory map whose paths share the given directory prefix. `stat` SHALL return a minimal `Stats` stub. `access` SHALL resolve for any file present in the map and reject with `ENOENT` for absent files.

#### Scenario: detect() runs without touching real file system in tests
- **WHEN** `detect(cwd, new InMemoryFileSystem({ '/cwd/package.json': '{"name":"test"}' }))` is called
- **THEN** no real file system operations SHALL occur

#### Scenario: Missing file throws ENOENT from InMemoryFileSystem
- **WHEN** `inMemoryFs.access('/nonexistent')` is called
- **THEN** it SHALL reject with an error where `code === 'ENOENT'`

### Requirement: detect() accepts optional FileSystem parameter
The `detect(cwd: string, fs?: FileSystem): Promise<Fingerprint>` function signature SHALL accept an optional second parameter. When omitted, it SHALL default to `new RealFileSystem()`. This maintains backward compatibility for all existing callers.

#### Scenario: Existing callers unaffected by new parameter
- **WHEN** existing code calls `detect(cwd)` without a second argument
- **THEN** it SHALL behave identically to the previous implementation
