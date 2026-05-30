## ADDED Requirements

### Requirement: FingerprintSchema includes field-level guards
The `FingerprintSchema` Zod schema SHALL include `.maxLength()` guards on all string fields, `.regex()` patterns on identifier fields (language names, framework names, backend names), and `.refine()` validators on pattern fields to reject values that could cause regex denial-of-service. Maximum string length SHALL be 512 characters for free-form fields and 64 characters for identifier fields.

#### Scenario: Oversized string field rejected
- **WHEN** `FingerprintSchema.parse()` receives a string field exceeding 512 characters
- **THEN** it SHALL throw a `ZodError` with a descriptive `.maxLength` message

#### Scenario: Invalid identifier characters rejected
- **WHEN** `FingerprintSchema.parse()` receives a backend name containing characters outside `[a-z0-9-_]`
- **THEN** it SHALL throw a `ZodError` with a `.regex` message

#### Scenario: Valid fingerprint passes hardened schema
- **WHEN** `FingerprintSchema.parse()` receives a well-formed fingerprint object
- **THEN** it SHALL return the parsed value without error

### Requirement: BlueprintIR schema includes field-level guards
The `BlueprintIR` Zod schema SHALL include `.maxLength()` on all string fields (max 2048 for content fields, 256 for path fields), and `.refine()` on any fields containing glob patterns to ensure the pattern does not contain more than 3 consecutive `*` characters (ReDoS prevention).

#### Scenario: Oversized content field rejected
- **WHEN** `BlueprintIR` parsing receives a content field exceeding 2048 characters
- **THEN** it SHALL throw a `ZodError`

#### Scenario: Malicious glob pattern rejected
- **WHEN** `BlueprintIR` parsing receives a pattern field containing `****`
- **THEN** it SHALL throw a `ZodError` with a `.refine` message about pattern safety

#### Scenario: Oversized path field rejected
- **WHEN** `BlueprintIR` parsing receives a file path field exceeding 256 characters
- **THEN** it SHALL throw a `ZodError`

### Requirement: Zod schemas are the single source of truth for inferred types
All TypeScript types derived from `FingerprintSchema` and `BlueprintIR` SHALL use `z.infer<typeof Schema>`. No parallel manually-written interfaces for these shapes SHALL exist. `as unknown as T` casts involving these types SHALL be eliminated.

#### Scenario: Type inferred from schema
- **WHEN** a function accepts a fingerprint parameter
- **THEN** its parameter type SHALL be `z.infer<typeof FingerprintSchema>`, not a manually declared `Fingerprint` interface
