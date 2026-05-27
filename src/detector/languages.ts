import * as fs from "node:fs";
import * as path from "node:path";
import type { LanguageName } from "./fingerprint.js";

export interface LanguageSignal {
  name: LanguageName;
  confidence: number;
  primary: boolean;
}

interface LangRule {
  name: LanguageName;
  highConfidenceFiles: string[];
  mediumConfidenceFiles: string[];
  srcExtensions?: string[];
}

const LANGUAGE_RULES: LangRule[] = [
  {
    name: "typescript",
    highConfidenceFiles: ["tsconfig.json"],
    mediumConfidenceFiles: ["package.json"],
    srcExtensions: [".ts", ".tsx"],
  },
  {
    name: "javascript",
    highConfidenceFiles: ["package.json"],
    mediumConfidenceFiles: [],
    srcExtensions: [".js", ".jsx", ".mjs", ".cjs"],
  },
  {
    name: "python",
    highConfidenceFiles: ["requirements.txt", "setup.py", "pyproject.toml", "poetry.lock"],
    mediumConfidenceFiles: ["setup.cfg"],
  },
  {
    name: "go",
    highConfidenceFiles: ["go.mod", "go.sum"],
    mediumConfidenceFiles: [],
  },
  {
    name: "rust",
    highConfidenceFiles: ["Cargo.toml", "Cargo.lock"],
    mediumConfidenceFiles: [],
  },
  {
    name: "java",
    highConfidenceFiles: ["pom.xml", "build.gradle", "build.gradle.kts"],
    mediumConfidenceFiles: [],
    srcExtensions: [".java", ".kt"],
  },
  {
    name: "ruby",
    highConfidenceFiles: ["Gemfile", "Gemfile.lock"],
    mediumConfidenceFiles: [],
    srcExtensions: [".rb"],
  },
  {
    name: "dart",
    highConfidenceFiles: ["pubspec.yaml"],
    mediumConfidenceFiles: [],
    srcExtensions: [".dart"],
  },
  {
    name: "cpp",
    highConfidenceFiles: ["CMakeLists.txt"],
    mediumConfidenceFiles: ["Makefile"],
    srcExtensions: [".cpp", ".cc", ".cxx", ".c", ".h", ".hpp"],
  },
  {
    name: "csharp",
    highConfidenceFiles: [],
    mediumConfidenceFiles: [],
    srcExtensions: [".csproj", ".sln"],
  },
  {
    name: "swift",
    highConfidenceFiles: ["Package.swift"],
    mediumConfidenceFiles: [],
    srcExtensions: [".swift"],
  },
];

function fileExists(filePath: string): boolean {
  try {
    fs.accessSync(filePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function countFilesWithExtensions(dir: string, extensions: string[]): number {
  if (!fileExists(dir)) return 0;
  let count = 0;
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && extensions.some((ext) => entry.name.endsWith(ext))) {
        count++;
      }
    }
  } catch {
    return 0;
  }
  return count;
}

export function detectLanguages(projectRoot: string): LanguageSignal[] {
  const results: LanguageSignal[] = [];

  for (const rule of LANGUAGE_RULES) {
    let confidence = 0;

    for (const file of rule.highConfidenceFiles) {
      if (fileExists(path.join(projectRoot, file))) {
        confidence = Math.max(confidence, 0.9);
      }
    }

    for (const file of rule.mediumConfidenceFiles) {
      if (fileExists(path.join(projectRoot, file))) {
        confidence = Math.max(confidence, 0.6);
      }
    }

    if (rule.srcExtensions && confidence < 0.9) {
      const srcDir = path.join(projectRoot, "src");
      const libDir = path.join(projectRoot, "lib");
      const extCount =
        countFilesWithExtensions(srcDir, rule.srcExtensions) +
        countFilesWithExtensions(libDir, rule.srcExtensions);
      if (extCount > 0) {
        confidence = Math.max(confidence, 0.7);
      }
    }

    if (confidence > 0) {
      results.push({ name: rule.name, confidence, primary: false });
    }
  }

  // TypeScript implies JavaScript — if TS found, don't double-count JS unless JS-only files exist
  const hasTS = results.some((r) => r.name === "typescript" && r.confidence >= 0.9);
  const jsIdx = results.findIndex((r) => r.name === "javascript");
  if (hasTS && jsIdx !== -1) {
    const jsResult = results[jsIdx];
    if (jsResult !== undefined) {
      jsResult.confidence = Math.max(0, jsResult.confidence - 0.3);
    }
    if (jsResult !== undefined && jsResult.confidence < 0.3) {
      results.splice(jsIdx, 1);
    }
  }

  // Mark highest confidence language as primary
  if (results.length > 0) {
    const maxConf = Math.max(...results.map((r) => r.confidence));
    const primary = results.find((r) => r.confidence === maxConf);
    if (primary !== undefined) {
      primary.primary = true;
    }
  }

  return results.sort((a, b) => b.confidence - a.confidence);
}
