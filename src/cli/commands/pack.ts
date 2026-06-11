import * as fsPromises from "node:fs/promises";
import * as path from "node:path";
import chalk from "chalk";
import { Command } from "commander";
import { BpError } from "../../errors.js";
import { normalizeError } from "../../utils/errors.js";

async function readKeyFile(keyPath: string): Promise<string> {
  try {
    return await fsPromises.readFile(keyPath, "utf-8");
  } catch {
    console.error(chalk.red(`Error: cannot read private key file: ${keyPath}`));
    throw new BpError("Command failed", 1, "CMD_ERROR", "");
  }
}

export function createPackCommand(): Command {
  const cmd = new Command("pack").description(
    "Publish and manage signed pack artifacts (rules, skills, plugins)"
  );

  cmd
    .command("keygen <name>")
    .description("Generate an RSA signing keypair under ~/.bp/keys/ (private key 0600)")
    .action(async (name: string) => {
      const { generateKeyFiles } = await import("../../registry/trust.js");
      const result = await generateKeyFiles(name);
      console.log(chalk.green(`✓ Generated signing keypair '${name}'`));
      console.log(`  Private key: ${result.privateKeyPath} ${chalk.dim("(0600 — never share)")}`);
      console.log(`  Public key:  ${result.publicKeyPath}`);
      console.log(
        chalk.dim(`  Consumers trust it with: bp trust add ${name} ${result.publicKeyPath}`)
      );
    });

  cmd
    .command("publish <file>")
    .description("Build a signed .bp-pack.tgz artifact from a pack file or plugin .mjs bundle")
    .requiredOption("--key <privateKeyPem>", "PEM private key file to sign with")
    .option("--out <dir>", "Output directory", ".")
    .option("--id <id>", "Artifact id (plugin publishes only)")
    .option("--version <version>", "Artifact version (plugin publishes only)")
    .option("--publisher <publisher>", "Publisher identity recorded in the manifest")
    .action(
      async (
        file: string,
        options: { key: string; out: string; id?: string; version?: string; publisher?: string }
      ) => {
        const { publishArtifact } = await import("../../registry/publish.js");
        const privateKeyPem = await readKeyFile(options.key);
        try {
          const publishOptions: Parameters<typeof publishArtifact>[0] = {
            filePath: file,
            privateKeyPem,
            outDir: options.out,
          };
          if (options.id !== undefined) publishOptions.pluginId = options.id;
          if (options.version !== undefined) publishOptions.pluginVersion = options.version;
          if (options.publisher !== undefined) publishOptions.publisher = options.publisher;
          const result = await publishArtifact(publishOptions);
          console.log(
            chalk.green(
              `✓ Published ${result.built.manifest.id} v${result.built.manifest.version} (${result.built.manifest.kind})`
            )
          );
          console.log(`  Artifact:    ${result.artifactPath}`);
          console.log(`  sha256:      ${result.built.artifactSha256}`);
          console.log(`  Index entry: ${result.indexEntryPath}`);
          console.log(
            chalk.dim("  Serve the artifact from any https host; see docs/pack-distribution.md")
          );
        } catch (e) {
          if (e instanceof BpError) throw e;
          console.error(chalk.red(`Publish failed: ${normalizeError(e).message}`));
          throw new BpError("Command failed", 1, "CMD_ERROR", "");
        }
      }
    );

  cmd
    .command("index:build <dir>")
    .description("Assemble *.index-entry.json snippets in a dir into a signed index.json/index.sig")
    .requiredOption("--key <privateKeyPem>", "PEM private key file to sign the index with")
    .option("--base-url <url>", "Prefix artifact file names with this URL")
    .action(async (dir: string, options: { key: string; baseUrl?: string }) => {
      const { IndexEntrySchema, RegistryIndexSchema, signIndex } = await import(
        "../../registry/registry-index.js"
      );
      const privateKeyPem = await readKeyFile(options.key);

      let names: string[];
      try {
        names = await fsPromises.readdir(dir);
      } catch {
        console.error(chalk.red(`Error: cannot read directory: ${dir}`));
        throw new BpError("Command failed", 1, "CMD_ERROR", "");
      }
      const entryFiles = names.filter((n) => n.endsWith(".index-entry.json")).sort();
      if (entryFiles.length === 0) {
        console.error(chalk.red(`Error: no *.index-entry.json files found in ${dir}`));
        console.error(chalk.dim("  Run 'bp pack publish' with --out pointing at this directory."));
        throw new BpError("Command failed", 1, "CMD_ERROR", "");
      }

      const packs = [];
      for (const name of entryFiles) {
        const raw = JSON.parse(await fsPromises.readFile(path.join(dir, name), "utf-8"));
        const entry = IndexEntrySchema.parse(raw);
        if (options.baseUrl && !entry.url.includes("://")) {
          entry.url = `${options.baseUrl.replace(/\/$/, "")}/${entry.url}`;
        }
        packs.push(entry);
      }

      const index = RegistryIndexSchema.parse({ schema: "bp-index/1", packs });
      const signature = signIndex(index, privateKeyPem);
      await fsPromises.writeFile(
        path.join(dir, "index.json"),
        `${JSON.stringify(index, null, 2)}\n`,
        "utf-8"
      );
      await fsPromises.writeFile(path.join(dir, "index.sig"), `${signature}\n`, "utf-8");
      console.log(chalk.green(`✓ Wrote signed index with ${packs.length} pack(s)`));
      console.log(`  ${path.join(dir, "index.json")}`);
      console.log(`  ${path.join(dir, "index.sig")}`);
    });

  cmd
    .command("plugin:install <ref>")
    .description("Install a plugin artifact (https URL, github: ref, .bp-pack.tgz path, or id)")
    .option(
      "--allow-unsigned",
      "Accept an unsigned plugin artifact (records it in the lockfile)",
      false
    )
    .option("--dry-run", "Preview without writing files", false)
    .action(async (ref: string, options: { allowUnsigned?: boolean; dryRun?: boolean }) => {
      const { installRemoteArtifact } = await import("../../registry/install.js");
      const result = await installRemoteArtifact(ref, {
        projectRoot: process.cwd(),
        allowUnsigned: options.allowUnsigned ?? false,
        dryRun: options.dryRun ?? false,
        expectKind: "plugin",
      });

      if (result.unsignedAccepted) {
        console.warn(
          chalk.yellow.bold(
            "⚠ SECURITY WARNING: this plugin artifact is UNSIGNED and its publisher cannot be verified."
          )
        );
        console.warn(
          chalk.yellow(
            "  Plugins execute code on your machine during 'bp verify'. Only proceed if you trust the source."
          )
        );
        console.warn(chalk.yellow('  Recorded in the lockfile as trust: "unsigned-accepted".'));
      }

      const verb = options.dryRun ? "[dry-run] Would install" : "Installed";
      console.log(chalk.green(`✓ ${verb} plugin '${result.id}' v${result.version}`));
      console.log(`  Trust:  ${result.trust}`);
      console.log(`  sha256: ${result.artifactSha256}`);
      for (const f of result.pluginFiles ?? []) console.log(chalk.green(`  + ${f}`));
      if (!options.dryRun) {
        console.log(
          chalk.dim(
            `  Reference it from .bp.json: { "plugins": [{ "path": "artifact:${result.id}", "mode": "isolated" }] }`
          )
        );
      }
    });

  return cmd;
}
