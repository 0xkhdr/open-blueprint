# open-blueprint (`bp`) — Codebase Contributor Guide

Welcome to the contributor guide for **open-blueprint (`bp`)**. This document provides the onboarding reference for developers wishing to run, test, and contribute to the CLI codebase.

---

## 1. Development Onboarding

### 1.1 Prerequisites
- **Node.js**: Version `>= 20.0.0`
- **npm** or **Bun** for package management.
- **Git**

### 1.2 Setup Instructions
Clone the repository and install dependency nodes:

```bash
git clone https://github.com/0xkhdr/open-blueprint.git
cd open-blueprint
npm install
```

---

## 2. Core Development Commands

During daily development, use the following scripts defined in `package.json`:

* **Build Code**: Compiles TypeScript modules to Node ESM javascript in `/dist`:
  ```bash
  npm run build
  ```
* **Run in Development**: Launches the CLI in real-time from source code using `tsx`:
  ```bash
  npm run dev -- --help
  npm run dev init claude
  ```
* **Check Formatting / Linting**: `bp` uses **Biome** for lightning-fast static analysis and style auditing:
  ```bash
  npm run lint
  ```
* **Auto-fix Style Errors**: Fixes linting and imports ordering automatically:
  ```bash
  npm run lint:fix
  ```
* **Typecheck**: Validates that all TypeScript annotations are fully correct without emitting output:
  ```bash
  npm run typecheck
  ```
* **Full CI Check**: Combines all verification layers to ensure your changes are fully ready for pull-request validation:
  ```bash
  npm run ci
  ```

---

## 3. Working with the Test Suite

`bp` maintains a rigorous test coverage contract ($>95\%$ coverage). The test runner is powered by **Vitest**.

```
tests/
├── unit/            # Isolated unit checks per engine module
├── integration/     # CLI integration sequences (init, verify, doctor)
├── fuzz/            # Property-based structure tests using fast-check
└── snapshots/       # Regression state snapshots of output blueprints
```

### 3.1 Test Commands
- **Run all tests once**:
  ```bash
  npm run test
  ```
- **Run tests in watch-mode** (recommended for active TDD):
  ```bash
  npm run test:watch
  ```
- **Measure code coverage**:
  ```bash
  npm run test:coverage
  ```

### 3.2 Fuzz Testing
`bp` utilizes `fast-check` inside `tests/fuzz/validator.test.ts` to fuzz the Validator engine. It ensures the validation pipeline never hangs, crashes, or panics when parsing random markdown structures or unexpected schemas.

---

## 4. Extending Codebase Features

### 4.1 Adding a New Field to the `Fingerprint`
1. **Update Zod Schema**: Add the property definition inside the Zod schema at `src/detector/fingerprint.ts`:
   ```typescript
   export const FingerprintSchema = z.object({
     // ...
     new_heuristic_field: z.string().optional(),
   });
   ```
2. **Implement Detection logic**: Edit the relevant sub-file in `src/detector/` (e.g. `tooling.ts` or `frameworks.ts`) to scrape or identify the directory signal.
3. **Register Heuristic**: Integrate the detector resolver inside the main `detect()` function in `src/detector/index.ts`.
4. **Update Template context**: Add the field to the template context builder in `src/templater/index.ts` so developers can reference it in Handlebars templates.
5. **Add Tests**: Write unit tests to check that the detector returns correct confidence scores when your signal is present.

### 4.2 Adding a Custom Validation Rule
1. **Locate Layer file**: Open the target layer module under `src/validator/`:
   - `structural.ts`: For document hierarchy, BOM, parsing, or structural checks.
   - `semantic.ts`: For glob resolution, references, and tool scopes.
   - `logical.ts`: For global circular cycles and contradicting intersections.
   - `drift.ts`: For fingerprint change detection.
2. **Define Rule Check**: Implement your checking method. The method should return a clean array of `ValidationError` objects conforming to this shape:
   ```typescript
   export interface ValidationError {
     file: string;
     type: string;            // e.g. "MY_RULE_CONFLICT"
     severity: "error" | "warning" | "info";
     message: string;
     resolution: string;      // Actionable advice for the user
     line?: number;
     column?: number;
   }
   ```
3. **Register Rule**: Call your check inside the central validation coordinator method `runValidator()` in `src/validator/index.ts`.
4. **Define Exit Code mapping**: Update `exitCodeForResult()` in `src/validator/index.ts` to ensure that a violation of your new rule returns the correct semantic CLI exit code.
