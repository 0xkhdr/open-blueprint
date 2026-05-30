## ADDED Requirements

### Requirement: Validator cache keyed by SHA-256 content hash
The validation cache in `src/validator/index.ts` SHALL use `crypto.createHash('sha256').update(fileContent).digest('hex')` as the primary cache key component rather than file mtime. Cache entries SHALL be keyed by `(filePath, contentHash)`. The `node:crypto` module SHALL be used — no new runtime dependencies.

#### Scenario: Cache hit on same content despite mtime change
- **WHEN** a file is restored from git (same content, updated mtime)
- **THEN** the validator SHALL return the cached result without re-validating

#### Scenario: Cache miss on content change
- **WHEN** a file's content changes (even with the same mtime)
- **THEN** the validator SHALL re-validate the file and update the cache entry

#### Scenario: Backdated file does not hit stale cache
- **WHEN** a file is modified but its mtime is set to a past value (e.g., via `touch -t`)
- **THEN** the content-hash cache SHALL detect the content change and re-validate

### Requirement: mtime pre-filter for hash computation efficiency
To avoid computing SHA-256 on every cache lookup, the system SHALL use mtime as a cheap pre-filter: if the file's mtime matches the cached mtime, the cached result SHALL be returned without hashing. If mtime differs, the content hash SHALL be computed and compared against the cached hash.

#### Scenario: mtime unchanged — no hash computation
- **WHEN** a file's mtime matches the cached value
- **THEN** the system SHALL skip SHA-256 computation and return the cached result directly

#### Scenario: mtime changed but content identical — cache hit after hash check
- **WHEN** a file's mtime changes but content is identical
- **THEN** SHA-256 SHALL match and the cached validation result SHALL be returned

### Requirement: Cache reads are async
All cache read and write operations SHALL use `fs/promises` equivalents. No `fs.existsSync` or `fs.statSync` calls SHALL remain in the cache path.

#### Scenario: Cache read does not block event loop
- **WHEN** the validator checks the cache for a previously validated file
- **THEN** the cache read SHALL be non-blocking
