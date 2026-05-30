## ADDED Requirements

### Requirement: HandlebarsRegistry pre-compiles and caches templates
The system SHALL provide a `HandlebarsRegistry` module at `src/templater/registry.ts` that maintains a `Map<string, HandlebarsTemplateDelegate>`. Templates SHALL be compiled on first access (lazy) and cached for subsequent invocations. The cache key SHALL be `${backend}::${templatePack}::${templateName}`.

#### Scenario: Template compiled once, reused on subsequent calls
- **WHEN** `runTemplater` is called twice with the same `(backend, templatePack, templateName)`
- **THEN** `Handlebars.compile` SHALL be called exactly once for that combination

#### Scenario: First invocation compiles and caches
- **WHEN** `runTemplater` is called for the first time with a given template key
- **THEN** the template SHALL be compiled and stored in the registry before rendering

#### Scenario: Different keys compile independently
- **WHEN** `runTemplater` is called with two different `(backend, templatePack)` combinations
- **THEN** each SHALL be compiled and cached independently

### Requirement: HandlebarsRegistry provides a test-mode clear function
The registry SHALL export a `clearForTesting()` function that empties the internal cache. This function SHALL only be callable in test environments (`NODE_ENV === 'test'`); in production it SHALL be a no-op.

#### Scenario: Cache cleared between test runs
- **WHEN** `clearForTesting()` is called in a test setup/teardown hook
- **THEN** the registry cache SHALL be empty and templates SHALL be recompiled on next access

#### Scenario: clearForTesting() is no-op in production
- **WHEN** `clearForTesting()` is called with `NODE_ENV !== 'test'`
- **THEN** it SHALL do nothing and the cache SHALL remain populated
