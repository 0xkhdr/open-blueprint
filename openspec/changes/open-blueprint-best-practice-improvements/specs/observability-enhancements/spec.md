## ADDED Requirements

### Requirement: Template cache is LRU with TTL
The `templateCache` in `src/templater/engine.ts` SHALL be an `LRUCache` instance from the `lru-cache` package. It MUST enforce a maximum entry count (`BP_TEMPLATE_CACHE_MAX`, default `500`) and a TTL (`BP_TEMPLATE_CACHE_TTL_MS`, default `300000` ms). The `clearTemplateCache()` function MUST remain and clear the LRU cache.

#### Scenario: Cache evicts oldest entry when full
- **WHEN** more than `BP_TEMPLATE_CACHE_MAX` unique templates are compiled
- **THEN** the least-recently-used entry is evicted automatically
- **THEN** total cache size never exceeds `BP_TEMPLATE_CACHE_MAX`

#### Scenario: Cache evicts expired entries
- **WHEN** a cached template has not been accessed for longer than `BP_TEMPLATE_CACHE_TTL_MS`
- **THEN** subsequent access to that template results in a cache miss and recompilation

#### Scenario: Cache size is bounded in long-running processes
- **WHEN** the LSP server or watch mode runs for an extended period
- **THEN** the template cache memory footprint remains bounded by the configured max
- **THEN** memory does not grow without bound over time

### Requirement: bp verify supports --format sarif output
`bp verify` SHALL accept a `--format` flag with values `json` (default) and `sarif`. When `--format sarif` is specified, the output SHALL be a SARIF 2.1.0 JSON document suitable for upload to GitHub Advanced Security.

#### Scenario: SARIF output contains required fields
- **WHEN** `bp verify --format sarif` is run
- **THEN** output is a valid JSON object with `$schema`, `version: "2.1.0"`, and `runs[]`
- **THEN** each finding appears as a `result` with `ruleId`, `message.text`, `locations[]`

#### Scenario: SARIF upload to GitHub succeeds
- **WHEN** `bp verify --format sarif > results.sarif` and the file is uploaded via `github/codeql-action/upload-sarif`
- **THEN** findings appear in the GitHub Security tab without parsing errors

#### Scenario: Default output format unchanged
- **WHEN** `bp verify` is run without `--format`
- **THEN** output format is identical to the previous behavior (no breaking change)

### Requirement: bp CLI pipeline is instrumented with OpenTelemetry
The `bp` CLI SHALL create OpenTelemetry spans for the following operations: command invocation, project detection, template rendering, structural validation, output writing, and audit logging. Spans SHALL be no-ops when no OTel SDK is registered in the environment.

#### Scenario: No-op when SDK absent
- **WHEN** `bp` is run without an `OTEL_EXPORTER_OTLP_ENDPOINT` or SDK configured
- **THEN** no telemetry data is exported
- **THEN** startup time is not measurably increased by span creation overhead

#### Scenario: Spans appear when SDK is configured
- **WHEN** an OTel SDK is configured (e.g., `OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317`)
- **THEN** spans for `bp.detect`, `bp.template`, `bp.validate`, `bp.write` are exported
- **THEN** each span includes the operation duration and success/error status

#### Scenario: Error spans include exception details
- **WHEN** validation fails during `bp verify`
- **THEN** the `bp.validate` span has `status: ERROR` and the exception message as an event
