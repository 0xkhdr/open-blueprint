import * as fs from "node:fs";
import * as path from "node:path";
import { logger } from "../logger.js";
import { PermissionError } from "../errors.js";
import { normalizeError } from "../utils/errors.js";
import { loadPublicKey, signData, verifySignature } from "./signer.js";

export interface RegistryAdapter {
  list(): Promise<RegistryPackage[]>;
}

function assertHttpsUrl(url: string): void {
  if (!url.startsWith("https://")) {
    throw new PermissionError(
      `Non-HTTPS URL rejected: '${url}'. Fix: Only https:// URLs are allowed for registry and marketplace fetches.`
    );
  }
}

export interface RegistryPackage {
  name: string;
  version: string;
  description: string;
  signature?: string;
  archiveData?: string; // base64 encoded archive content (mocked for simplicity)
}

export class RegistryClient {
  private registryUrl: string;
  private registryAdapter: RegistryAdapter | undefined;

  // Local mock store for offline testing
  private static mockRegistry: Map<string, RegistryPackage[]> = new Map();

  public token: string | undefined;

  constructor(registryUrl = "https://registry.npmjs.org", token?: string, adapter?: RegistryAdapter) {
    assertHttpsUrl(registryUrl);
    this.registryUrl = registryUrl;
    this.token = token;
    this.registryAdapter = adapter;
  }

  // Register mock packages for unit tests
  static registerMockPackage(pkg: RegistryPackage) {
    const list = RegistryClient.mockRegistry.get(pkg.name) || [];
    list.push(pkg);
    RegistryClient.mockRegistry.set(pkg.name, list);
  }

  static clearMockPackages() {
    RegistryClient.mockRegistry.clear();
  }

  async list(): Promise<RegistryPackage[]> {
    if (this.registryAdapter) {
      return this.registryAdapter.list();
    }
    if (RegistryClient.mockRegistry.size > 0) {
      const all: RegistryPackage[] = [];
      for (const pkgs of RegistryClient.mockRegistry.values()) {
        const latest = pkgs[pkgs.length - 1];
        if (latest) all.push(latest);
      }
      return all;
    }

    // In a real environment, we'd query the npm registry. Let's return standard official packs
    return [
      {
        name: "@bp-templates/fastapi",
        version: "1.0.0",
        description: "Official FastAPI template pack",
      },
      {
        name: "@bp-templates/django",
        version: "1.0.0",
        description: "Official Django template pack",
      },
      {
        name: "@bp-templates/go-std",
        version: "1.0.0",
        description: "Official Go standard library pack",
      },
      {
        name: "@bp-templates/rust-axum",
        version: "1.0.0",
        description: "Official Rust Axum template pack",
      },
    ];
  }

  async install(
    packageName: string,
    targetDir: string,
    publicKey?: string
  ): Promise<void> {
    const resolvedPublicKey = publicKey ?? loadPublicKey();
    if (!resolvedPublicKey) {
      logger.warn("BP_REGISTRY_PUBLIC_KEY not configured; registry signature verification skipped");
    }
    // Locate the package
    const pkgs = RegistryClient.mockRegistry.get(packageName);
    if (!pkgs || pkgs.length === 0) {
      // In real scenario, fetch from NPM registry. For this CLI, if not in mock, we simulate downloading a built-in template.
      const isOfficial = packageName.startsWith("@bp-templates/");
      const packName = isOfficial ? packageName.replace("@bp-templates/", "") : packageName;

      const sourceTemplateDir = path.join(
        path.dirname(new URL(import.meta.url).pathname),
        "../../templates",
        packName
      );
      if (fs.existsSync(sourceTemplateDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
        fs.cpSync(sourceTemplateDir, targetDir, { recursive: true });
        return;
      }
      throw new Error(`Package "${packageName}" not found in registry.`);
    }

    const latest = pkgs[pkgs.length - 1];
    if (!latest) throw new Error(`Package "${packageName}" has no versions.`);

    // Extract archive data and verify signature
    if (latest.archiveData && latest.signature) {
      const buffer = Buffer.from(latest.archiveData, "base64");

      if (resolvedPublicKey) {
        const isValid = verifySignature(buffer, latest.signature, resolvedPublicKey);
        if (!isValid) {
          throw new Error(`Signature verification failed for package ${packageName}.`);
        }
      }

      // Simulate unpacking/extracting files to targetDir
      fs.mkdirSync(targetDir, { recursive: true });
      // In mock, archiveData is a simple JSON string representation of files to write
      try {
        const files = JSON.parse(buffer.toString("utf-8")) as Record<string, string>;
        for (const [relPath, content] of Object.entries(files)) {
          const fullPath = path.join(targetDir, relPath);
          fs.mkdirSync(path.dirname(fullPath), { recursive: true });
          fs.writeFileSync(fullPath, content, "utf-8");
        }
      } catch (err) {
        throw new Error(`Failed to extract package archive: ${normalizeError(err).message}`);
      }
    } else {
      throw new Error(`Package "${packageName}" is missing signature or archive data.`);
    }
  }

  async publish(
    packageName: string,
    version: string,
    packDir: string,
    privateKey: string
  ): Promise<void> {
    if (!fs.existsSync(packDir)) {
      throw new Error(`Pack directory does not exist: ${packDir}`);
    }

    // Build the package archive (in mock, we serialize files into a JSON string)
    const files: Record<string, string> = {};

    function walk(dir: string, base: string) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relPath = path.relative(base, fullPath);
        if (entry.isDirectory()) {
          walk(fullPath, base);
        } else {
          files[relPath] = fs.readFileSync(fullPath, "utf-8");
        }
      }
    }

    walk(packDir, packDir);

    const archiveBuffer = Buffer.from(JSON.stringify(files), "utf-8");
    const signature = signData(archiveBuffer, privateKey);

    const newPkg: RegistryPackage = {
      name: packageName,
      version,
      description: `Published package ${packageName}`,
      signature,
      archiveData: archiveBuffer.toString("base64"),
    };

    // Store in mock registry
    const list = RegistryClient.mockRegistry.get(packageName) || [];
    list.push(newPkg);
    RegistryClient.mockRegistry.set(packageName, list);
  }
}
