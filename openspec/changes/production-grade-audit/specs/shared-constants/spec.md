## ADDED Requirements

### Requirement: EXIT_CODES defined in src/constants.ts
The `EXIT_CODES` object SHALL be defined in `src/constants.ts`. All existing imports of `EXIT_CODES` from `src/validator/index.ts` in `cli/commands/init.ts` and `cli/index.ts` SHALL be updated to import from `src/constants.ts`. `src/validator/index.ts` MAY re-export `EXIT_CODES` from `src/constants.ts` for one release cycle to avoid breaking any external consumers.

#### Scenario: CLI imports EXIT_CODES without crossing domain boundary
- **WHEN** `cli/commands/init.ts` uses an exit code
- **THEN** it SHALL import from `src/constants.ts`, not from `src/validator/index.ts`

#### Scenario: Validator still exports EXIT_CODES for backward compat
- **WHEN** code imports `EXIT_CODES` from `src/validator/index.ts`
- **THEN** it SHALL receive the same values (re-exported from `src/constants.ts`)

### Requirement: Magic values centralized in src/constants.ts
Hardcoded directory names (`src`, `lib`, `app`, `source`), framework names (`nestjs`, `express`, `fastapi`), and default glob patterns that appear in more than one file SHALL be extracted to named exports in `src/constants.ts`.

#### Scenario: Hardcoded directory name replaced by constant
- **WHEN** the detector checks for known source directories
- **THEN** it SHALL reference `KNOWN_SOURCE_DIRS` from `src/constants.ts` rather than an inline array literal

#### Scenario: No magic strings in detector or validator
- **WHEN** a code review tool scans `src/detector/index.ts` and `src/validator/index.ts` for bare string literals matching known directory or framework names
- **THEN** no matches SHALL be found; all such strings SHALL appear only in `src/constants.ts`
