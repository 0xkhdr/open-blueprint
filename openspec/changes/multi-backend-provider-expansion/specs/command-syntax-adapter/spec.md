## ADDED Requirements

### Requirement: Syntax adapter resolves invocation string per backend and workflow
`src/backends/syntax.ts` SHALL export a `CommandSyntaxAdapter` class with a method `getInvocation(backendId: string, workflowId: string): string` that returns the correct slash command string for the given backend's `commandSyntax` value.

| `commandSyntax` | Output pattern |
|---|---|
| `colon` | `/opsx:<workflowId>` |
| `hyphen` | `/opsx-<workflowId>` |
| `bare` | `/openspec-<workflowId>` |
| `skill` | `/skill:openspec-<workflowId>` |

#### Scenario: Colon syntax backend
- **WHEN** `getInvocation("claude", "propose")` is called
- **THEN** it returns `"/opsx:propose"`

#### Scenario: Hyphen syntax backend
- **WHEN** `getInvocation("cursor", "propose")` is called
- **THEN** it returns `"/opsx-propose"`

#### Scenario: Bare syntax backend
- **WHEN** `getInvocation("gemini", "propose")` is called
- **THEN** it returns `"/openspec-propose"`

#### Scenario: Skill syntax backend
- **WHEN** `getInvocation("kimi", "propose")` is called
- **THEN** it returns `"/skill:openspec-propose"`

### Requirement: Syntax adapter is independent of translator adapters
The `CommandSyntaxAdapter` SHALL NOT import any translator adapter classes. It SHALL only import from `src/backends/registry.ts`.

#### Scenario: No circular dependency
- **WHEN** `CommandSyntaxAdapter` module is loaded
- **THEN** no import chain resolves through `src/translator/adapters/`
