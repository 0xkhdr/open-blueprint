import * as fs from "node:fs";
import * as path from "node:path";

export interface ToolingSignals {
  package_manager?: string;
  test_runner?: string;
  test_command?: string;
  build_tool?: string;
  linter?: string;
  formatter?: string;
  ci_system?: string;
}

function fileExists(filePath: string): boolean {
  try {
    fs.accessSync(filePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function readFile(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, "utf-8");
  } catch {
    return null;
  }
}

function detectPackageManager(root: string): string | undefined {
  if (fileExists(path.join(root, "bun.lockb"))) return "bun";
  if (fileExists(path.join(root, "pnpm-lock.yaml"))) return "pnpm";
  if (fileExists(path.join(root, "yarn.lock"))) return "yarn";
  if (fileExists(path.join(root, "package-lock.json"))) return "npm";
  if (fileExists(path.join(root, "poetry.lock"))) return "poetry";
  if (fileExists(path.join(root, "Pipfile.lock"))) return "pipenv";
  if (fileExists(path.join(root, "go.mod"))) return "go modules";
  if (fileExists(path.join(root, "Cargo.lock"))) return "cargo";
  if (fileExists(path.join(root, "Gemfile.lock"))) return "bundler";
  return undefined;
}

function detectTestRunner(root: string): string | undefined {
  if (
    fileExists(path.join(root, "vitest.config.ts")) ||
    fileExists(path.join(root, "vitest.config.js")) ||
    fileExists(path.join(root, "vitest.config.mjs"))
  )
    return "vitest";
  if (
    fileExists(path.join(root, "jest.config.js")) ||
    fileExists(path.join(root, "jest.config.ts")) ||
    fileExists(path.join(root, "jest.config.mjs"))
  )
    return "jest";
  if (fileExists(path.join(root, "pytest.ini")) || fileExists(path.join(root, "conftest.py")))
    return "pytest";
  if (fileExists(path.join(root, "go.mod"))) return "go test";
  if (fileExists(path.join(root, "Cargo.toml"))) return "cargo test";
  if (fileExists(path.join(root, "Gemfile"))) return "rspec";
  return undefined;
}

function detectTestCommand(root: string, testRunner: string | undefined): string | undefined {
  const pkgPath = path.join(root, "package.json");
  if (fileExists(pkgPath)) {
    const content = readFile(pkgPath);
    if (content) {
      try {
        const pkg = JSON.parse(content) as { scripts?: Record<string, string> };
        const scripts = pkg.scripts ?? {};
        if (scripts.test) return `npm test`;
        if (scripts["test:run"]) return `npm run test:run`;
      } catch {
        /* skip */
      }
    }
  }
  if (testRunner === "pytest") return "pytest";
  if (testRunner === "go test") return "go test ./...";
  if (testRunner === "cargo test") return "cargo test";
  if (testRunner === "rspec") return "bundle exec rspec";
  return undefined;
}

function detectBuildTool(root: string): string | undefined {
  if (
    fileExists(path.join(root, "vite.config.ts")) ||
    fileExists(path.join(root, "vite.config.js"))
  )
    return "vite";
  if (
    fileExists(path.join(root, "webpack.config.js")) ||
    fileExists(path.join(root, "webpack.config.ts"))
  )
    return "webpack";
  if (fileExists(path.join(root, "rollup.config.js"))) return "rollup";
  if (fileExists(path.join(root, "turbo.json"))) return "turborepo";
  if (fileExists(path.join(root, "nx.json"))) return "nx";
  if (fileExists(path.join(root, "Makefile"))) return "make";
  if (fileExists(path.join(root, "Dockerfile"))) return "docker";
  return undefined;
}

function detectLinter(root: string): string | undefined {
  if (fileExists(path.join(root, "biome.json"))) return "biome";
  const eslintFiles = [
    ".eslintrc",
    ".eslintrc.js",
    ".eslintrc.ts",
    ".eslintrc.json",
    ".eslintrc.yml",
    ".eslintrc.yaml",
    "eslint.config.js",
    "eslint.config.mjs",
  ];
  for (const f of eslintFiles) {
    if (fileExists(path.join(root, f))) return "eslint";
  }
  const pyprojectPath = path.join(root, "pyproject.toml");
  if (fileExists(pyprojectPath)) {
    const content = readFile(pyprojectPath);
    if (content?.includes("[tool.ruff]") || content?.includes("ruff")) return "ruff";
  }
  if (fileExists(path.join(root, ".flake8"))) return "flake8";
  if (fileExists(path.join(root, ".golangci.yml")) || fileExists(path.join(root, ".golangci.yaml")))
    return "golangci-lint";
  if (fileExists(path.join(root, ".rubocop.yml"))) return "rubocop";
  if (fileExists(path.join(root, "clippy.toml"))) return "clippy";
  return undefined;
}

function detectFormatter(root: string): string | undefined {
  if (fileExists(path.join(root, "biome.json"))) return "biome";
  const prettierFiles = [
    ".prettierrc",
    ".prettierrc.js",
    ".prettierrc.json",
    ".prettierrc.yml",
    ".prettierrc.yaml",
    "prettier.config.js",
  ];
  for (const f of prettierFiles) {
    if (fileExists(path.join(root, f))) return "prettier";
  }
  const pyprojectPath = path.join(root, "pyproject.toml");
  if (fileExists(pyprojectPath)) {
    const content = readFile(pyprojectPath);
    if (content?.includes("[tool.black]")) return "black";
    if (content?.includes("[tool.ruff.format]")) return "ruff";
  }
  if (fileExists(path.join(root, ".black"))) return "black";
  return undefined;
}

function detectCiSystem(root: string): string | undefined {
  const ghActionsDir = path.join(root, ".github/workflows");
  if (fileExists(ghActionsDir)) {
    try {
      const files = fs.readdirSync(ghActionsDir);
      if (files.some((f) => f.endsWith(".yml") || f.endsWith(".yaml"))) return "github-actions";
    } catch {
      /* skip */
    }
  }
  if (fileExists(path.join(root, ".gitlab-ci.yml"))) return "gitlab-ci";
  if (fileExists(path.join(root, ".circleci/config.yml"))) return "circleci";
  if (fileExists(path.join(root, "Jenkinsfile"))) return "jenkins";
  if (fileExists(path.join(root, ".travis.yml"))) return "travis-ci";
  if (fileExists(path.join(root, "azure-pipelines.yml"))) return "azure-devops";
  return undefined;
}

export function detectTooling(root: string): ToolingSignals {
  const package_manager = detectPackageManager(root);
  const test_runner = detectTestRunner(root);
  const test_command = detectTestCommand(root, test_runner);
  const build_tool = detectBuildTool(root);
  const linter = detectLinter(root);
  const formatter = detectFormatter(root);
  const ci_system = detectCiSystem(root);

  return {
    ...(package_manager !== undefined && { package_manager }),
    ...(test_runner !== undefined && { test_runner }),
    ...(test_command !== undefined && { test_command }),
    ...(build_tool !== undefined && { build_tool }),
    ...(linter !== undefined && { linter }),
    ...(formatter !== undefined && { formatter }),
    ...(ci_system !== undefined && { ci_system }),
  };
}
