## ADDED Requirements

### Requirement: computeSimilarity returns binary equality result
`computeSimilarity(hash1, hash2)` SHALL return `1.0` when the two hashes are identical and `0.0` otherwise. It MUST NOT perform arithmetic on hash string lengths.

#### Scenario: Identical hashes return 1.0
- **WHEN** `computeSimilarity` is called with two equal SHA-256 hex strings
- **THEN** the function returns `1.0`

#### Scenario: Different hashes return 0.0
- **WHEN** `computeSimilarity` is called with two distinct SHA-256 hex strings of the same length
- **THEN** the function returns `0.0` (not `0.75` or any other non-zero value)

#### Scenario: Drift threshold fires on changed output
- **WHEN** a previously recorded output hash differs from the current computed hash
- **THEN** `checkOutputDrift` records the event as a drift occurrence with similarity `0.0`
- **THEN** the drift event is surfaced to the caller

### Requirement: Single canonical secret scanner
All secret scanning SHALL use `security/scan.ts` (`scanContent()` with entropy + regex engine). No other secret scanning module SHALL exist in `src/`.

#### Scenario: doctor --secret-scan uses canonical scanner
- **WHEN** `bp doctor --secret-scan` is run
- **THEN** it calls `scanContent()` from `security/scan.ts`
- **THEN** it detects all 9 pattern types plus high-entropy strings

#### Scenario: enterprise/secrets.ts removed
- **WHEN** the source tree is searched for `enterprise/secrets`
- **THEN** no file at that path exists
- **THEN** no import of `enterprise/secrets` appears in any source file

### Requirement: ink dependency removed
The `ink` package SHALL NOT appear in `package.json` dependencies or `node_modules` unless Ink-based TUI components are implemented.

#### Scenario: ink absent from dependency tree
- **WHEN** `npm ls ink` is run in the project root
- **THEN** the command reports `ink` is not installed as a direct dependency

#### Scenario: No ink import in source
- **WHEN** source files are searched for `import.*from 'ink'` or `require('ink')`
- **THEN** no match is found
