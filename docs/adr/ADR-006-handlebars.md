# ADR-006: Handlebars for Template Rendering

**Status**: Accepted  
**Date**: 2024-01-01  

## Context

`bp init` renders governance file templates from a registry of `.hbs` template packs. The template engine must support: logic-less templates (no arbitrary code execution), partial inclusion, custom helpers, and synchronous rendering (for atomic file writes).

## Decision

Use Handlebars for template rendering. Templates stored as `.hbs` files under `templates/`.

## Rationale

- Logic-less by design — template authors cannot embed arbitrary JavaScript
- Built-in support for partials, block helpers, and context variables
- Synchronous `Handlebars.compile(template)(context)` API fits the atomic write pattern
- Well-understood by frontend/backend developers; low onboarding cost
- `@types/handlebars` provides TypeScript types

## Alternatives Considered

- **EJS**: Allows arbitrary JS in templates — violates the "logic-less template" security requirement
- **Nunjucks**: More capable but same arbitrary-code risk; Mozilla-maintained with less community momentum
- **Mustache**: Subset of Handlebars with no helpers — too limited for conditional sections and loops

## Consequences

- Template variables sanitized before rendering (strip shell metacharacters)
- Custom helpers registered at startup in `src/templater/engine.ts`
- Templates cannot import modules or execute shell commands
- Rendering lifecycle documented in `docs/api/templater.md`
