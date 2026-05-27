import * as fs from "node:fs";
import * as path from "node:path";

export interface FrameworkSignal {
  name: string;
  confidence: number;
}

interface FrameworkRule {
  name: string;
  detect: (root: string, pkg: PackageJson | null) => number;
}

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

function fileExists(filePath: string): boolean {
  try {
    fs.accessSync(filePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function hasDep(pkg: PackageJson | null, depName: string): boolean {
  if (!pkg) return false;
  return depName in (pkg.dependencies ?? {}) || depName in (pkg.devDependencies ?? {});
}

function readPackageJson(root: string): PackageJson | null {
  const pkgPath = path.join(root, "package.json");
  if (!fileExists(pkgPath)) return null;
  try {
    const raw = fs.readFileSync(pkgPath, "utf-8");
    return JSON.parse(raw) as PackageJson;
  } catch {
    return null;
  }
}

const FRAMEWORK_RULES: FrameworkRule[] = [
  {
    name: "nextjs",
    detect: (root, pkg) => {
      const hasDep_ = hasDep(pkg, "next");
      const hasConfig =
        fileExists(path.join(root, "next.config.js")) ||
        fileExists(path.join(root, "next.config.ts")) ||
        fileExists(path.join(root, "next.config.mjs"));
      if (hasDep_ && hasConfig) return 0.95;
      if (hasDep_) return 0.85;
      if (hasConfig) return 0.7;
      return 0;
    },
  },
  {
    name: "react",
    detect: (_root, pkg) => {
      if (hasDep(pkg, "react")) return 0.9;
      return 0;
    },
  },
  {
    name: "express",
    detect: (root, pkg) => {
      const hasDep_ = hasDep(pkg, "express");
      const hasServer =
        fileExists(path.join(root, "app.js")) ||
        fileExists(path.join(root, "server.js")) ||
        fileExists(path.join(root, "src/app.js")) ||
        fileExists(path.join(root, "src/server.js"));
      if (hasDep_ && hasServer) return 0.95;
      if (hasDep_) return 0.85;
      return 0;
    },
  },
  {
    name: "nestjs",
    detect: (root, pkg) => {
      const hasDep_ = hasDep(pkg, "@nestjs/core");
      const hasMain = fileExists(path.join(root, "src/main.ts"));
      if (hasDep_ && hasMain) return 0.95;
      if (hasDep_) return 0.85;
      return 0;
    },
  },
  {
    name: "fastapi",
    detect: (root) => {
      const reqPath = path.join(root, "requirements.txt");
      if (fileExists(reqPath)) {
        try {
          const content = fs.readFileSync(reqPath, "utf-8");
          if (content.toLowerCase().includes("fastapi")) return 0.9;
        } catch {
          /* skip */
        }
      }
      const pyprojectPath = path.join(root, "pyproject.toml");
      if (fileExists(pyprojectPath)) {
        try {
          const content = fs.readFileSync(pyprojectPath, "utf-8");
          if (content.includes("fastapi")) return 0.9;
        } catch {
          /* skip */
        }
      }
      return 0;
    },
  },
  {
    name: "django",
    detect: (root) => {
      const hasManage = fileExists(path.join(root, "manage.py"));
      const hasSettings =
        fileExists(path.join(root, "settings.py")) ||
        fileExists(path.join(root, "config/settings.py"));
      if (hasManage) return 0.95;
      if (hasSettings) return 0.8;
      return 0;
    },
  },
  {
    name: "vue",
    detect: (_root, pkg) => {
      if (hasDep(pkg, "vue")) return 0.9;
      return 0;
    },
  },
  {
    name: "nuxt",
    detect: (root, pkg) => {
      if (hasDep(pkg, "nuxt")) return 0.9;
      if (
        fileExists(path.join(root, "nuxt.config.ts")) ||
        fileExists(path.join(root, "nuxt.config.js"))
      )
        return 0.85;
      return 0;
    },
  },
  {
    name: "svelte",
    detect: (_root, pkg) => {
      if (hasDep(pkg, "@sveltejs/kit")) return 0.9;
      if (hasDep(pkg, "svelte")) return 0.85;
      return 0;
    },
  },
  {
    name: "flutter",
    detect: (root) => {
      const pubspecPath = path.join(root, "pubspec.yaml");
      if (fileExists(pubspecPath)) {
        try {
          const content = fs.readFileSync(pubspecPath, "utf-8");
          if (content.includes("flutter")) return 0.9;
        } catch {
          /* skip */
        }
      }
      return 0;
    },
  },
  {
    name: "spring-boot",
    detect: (root) => {
      const pomPath = path.join(root, "pom.xml");
      const gradlePath = path.join(root, "build.gradle");
      const gradleKtsPath = path.join(root, "build.gradle.kts");
      for (const p of [pomPath, gradlePath, gradleKtsPath]) {
        if (fileExists(p)) {
          try {
            const content = fs.readFileSync(p, "utf-8");
            if (content.includes("spring-boot-starter")) return 0.9;
          } catch {
            /* skip */
          }
        }
      }
      return 0;
    },
  },
  {
    name: "axum",
    detect: (root) => {
      const cargoPath = path.join(root, "Cargo.toml");
      if (fileExists(cargoPath)) {
        try {
          const content = fs.readFileSync(cargoPath, "utf-8");
          if (content.includes("axum")) return 0.9;
        } catch {
          /* skip */
        }
      }
      return 0;
    },
  },
  {
    name: "actix-web",
    detect: (root) => {
      const cargoPath = path.join(root, "Cargo.toml");
      if (fileExists(cargoPath)) {
        try {
          const content = fs.readFileSync(cargoPath, "utf-8");
          if (content.includes("actix-web")) return 0.9;
        } catch {
          /* skip */
        }
      }
      return 0;
    },
  },
  {
    name: "rails",
    detect: (root) => {
      const gemfilePath = path.join(root, "Gemfile");
      if (fileExists(gemfilePath)) {
        try {
          const content = fs.readFileSync(gemfilePath, "utf-8");
          if (content.includes("rails")) return 0.9;
        } catch {
          /* skip */
        }
      }
      const configPath = path.join(root, "config/application.rb");
      if (fileExists(configPath)) return 0.85;
      return 0;
    },
  },
];

export function detectFrameworks(projectRoot: string): FrameworkSignal[] {
  const pkg = readPackageJson(projectRoot);
  const results: FrameworkSignal[] = [];

  for (const rule of FRAMEWORK_RULES) {
    const confidence = rule.detect(projectRoot, pkg);
    if (confidence > 0) {
      results.push({ name: rule.name, confidence });
    }
  }

  return results.sort((a, b) => b.confidence - a.confidence);
}
