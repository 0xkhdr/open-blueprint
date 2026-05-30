## ADDED Requirements

### Requirement: Map-based adapter registry replaces switch statement
The system SHALL replace the `switch`-based `getAdapterByName()` implementation in `src/validator/index.ts` with a `Map<string, () => Adapter>` registry defined in `src/translator/adapters/registry.ts`. The registry SHALL be populated at module load time via `Object.entries` over an exported registry object. Lookup SHALL be O(1).

#### Scenario: Known adapter resolved in O(1)
- **WHEN** `getAdapterByName('claude')` is called
- **THEN** it SHALL return the Claude adapter instance without iterating through a switch

#### Scenario: Unknown adapter falls back to GenericAdapter
- **WHEN** `getAdapterByName('unknown-backend')` is called
- **THEN** it SHALL return `new GenericAdapter()` without throwing

#### Scenario: Registry is exhaustiveness-checked at compile time
- **WHEN** a new backend type is added to the `Backend` union type
- **THEN** a TypeScript compile error SHALL occur if the registry object does not include the new key

### Requirement: Adapter registry file is single source of truth
The file `src/translator/adapters/registry.ts` SHALL be the single place where adapter class-to-name mappings are defined. `validator/index.ts` SHALL import from this registry; no other file SHALL maintain a parallel mapping.

#### Scenario: Adding a new adapter requires one file change
- **WHEN** a developer adds a new adapter class
- **THEN** they SHALL only need to add one entry in `src/translator/adapters/registry.ts` for it to be resolved by the validator
