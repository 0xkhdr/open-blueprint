## ADDED Requirements

### Requirement: Template vars SHALL be validated with Zod before rendering
Before merging `vars` into the Handlebars template context, the system SHALL validate the input using a Zod schema that enforces: record type with string keys, maximum object nesting depth of 5, maximum string value length of 10,000 characters, and no keys matching Handlebars built-in helper names (`if`, `unless`, `each`, `with`, `lookup`, `log`). Validation errors SHALL throw a `TemplateVarsValidationError` with a structured message listing each failing field.

#### Scenario: Valid flat vars pass through
- **WHEN** `vars` is `{ name: "my-project", version: "1.0.0" }`
- **THEN** validation passes and rendering proceeds without error

#### Scenario: Oversized string value is rejected
- **WHEN** a string value in `vars` exceeds 10,000 characters
- **THEN** `TemplateVarsValidationError` is thrown with message indicating the offending key

#### Scenario: Reserved Handlebars helper key is rejected
- **WHEN** `vars` contains a key named `each`
- **THEN** `TemplateVarsValidationError` is thrown before any template compilation

#### Scenario: Deeply nested object beyond depth limit is rejected
- **WHEN** `vars` contains an object nested 6 levels deep
- **THEN** `TemplateVarsValidationError` is thrown with depth violation message

### Requirement: Template vars SHALL have prototype chain stripped before context merge
After Zod validation, the system SHALL strip the prototype chain from `vars` by round-tripping through `JSON.parse(JSON.stringify(vars))` before passing to `deepFreeze` and the Handlebars context. This SHALL prevent prototype pollution of the template rendering context.

#### Scenario: Object with custom prototype is sanitized
- **WHEN** `vars` is constructed with a custom prototype carrying a `toString` override
- **THEN** the rendered template context contains a plain object with `null`-equivalent prototype (no custom methods)

#### Scenario: `__proto__` key in vars is dropped
- **WHEN** `vars` JSON-parses to contain `__proto__` as a key
- **THEN** the key is absent from the context passed to the Handlebars engine
