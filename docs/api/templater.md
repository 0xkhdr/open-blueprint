# Templater Engine API

The Templater engine renders Handlebars templates from a template registry into governance files for a detected project.

## Template Context Schema

```typescript
interface TemplateContext {
  projectName: string;
  language: string;
  framework?: string;
  runtime?: string;
  hasTests: boolean;
  hasCICD: boolean;
  riskTier: "low" | "medium" | "high" | "critical";
  tooling: string[];
  timestamp: string;           // ISO timestamp of render
  blueprintVersion: string;    // "2.0"
  customVars?: Record<string, string>;  // user-supplied via --vars flag
}
```

## Handlebars Helper Catalogue

| Helper | Signature | Description |
|--------|-----------|-------------|
| `eq` | `{{#if (eq a b)}}` | Strict equality check |
| `includes` | `{{#if (includes arr item)}}` | Array membership test |
| `upper` | `{{upper str}}` | Uppercase string |
| `lower` | `{{lower str}}` | Lowercase string |
| `capitalize` | `{{capitalize str}}` | Capitalize first letter |
| `join` | `{{join arr ", "}}` | Join array with separator |
| `hasFeature` | `{{#if (hasFeature "docker")}}` | Test for detected feature in fingerprint |
| `riskGte` | `{{#if (riskGte "medium")}}` | True if risk tier ≥ given tier |

## Rendering Lifecycle

```text
1. bp init <backend> invoked
         │
         ▼
2. Detector.detect(cwd) → Fingerprint
         │
         ▼
3. TemplateSelector.select(fingerprint) → TemplatePack[]
   (picks best-match templates from registry by framework + risk tier)
         │
         ▼
4. For each template in pack:
   a. Read .hbs file from registry
   b. Sanitize user-supplied customVars (strip shell metacharacters)
   c. Build TemplateContext from Fingerprint + customVars
   d. Handlebars.compile(template)(context) → rendered string
   e. Write to target path (atomic: tmp file → rename)
   f. Emit audit log: { event: "file.write", path, operation: "init" }
         │
         ▼
5. Validator.validate(cwd, "structural") → pass/fail
   (post-init validation unless --no-verify)
```
