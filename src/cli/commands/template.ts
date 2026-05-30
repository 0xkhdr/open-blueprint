import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import chalk from "chalk";
import { Command } from "commander";
import ora from "ora";
import { RegistryClient } from "../../registry/client.js";
import { getTemplatesRoot } from "../../templater/selector.js";
import { EXIT_CODES } from "../../validator/index.js";
import { normalizeError } from "../../utils/errors.js";
import { BpError } from "../../errors.js";

export function createTemplateCommand(): Command {
  const cmd = new Command("template").description("Manage template packs");

  cmd
    .command("list")
    .description("List available packs")
    .option("--registry <url>", "Registry URL", "https://registry.npmjs.org")
    .action(async (opts: { registry: string }) => {
      const spinner = ora("Fetching available template packs...").start();
      try {
        const client = new RegistryClient(opts.registry);
        const packs = await client.list();
        spinner.succeed("Available template packs:");
        for (const pack of packs) {
          console.log(`  ${chalk.bold.green(pack.name)} (v${pack.version})`);
          console.log(`    ${chalk.dim(pack.description)}`);
        }
        return;
      } catch (e) {
        spinner.fail(`Failed to list templates: ${normalizeError(e).message}`);
        throw new BpError("Command failed", EXIT_CODES.GENERAL_ERROR, "CMD_ERROR", "");
      }
    });

  cmd
    .command("install <pkg>")
    .description("Install a template pack from registry")
    .option("--registry <url>", "Registry URL", "https://registry.npmjs.org")
    .action(async (pkgName: string, opts: { registry: string }) => {
      const spinner = ora(`Installing template pack "${pkgName}"...`).start();
      try {
        const client = new RegistryClient(opts.registry);

        // We will extract to TEMPLATES_ROOT/<backend>/<packName>
        // Default packName is derived from pkgName
        const isOfficial = pkgName.startsWith("@bp-templates/");
        const cleanName = isOfficial ? pkgName.replace("@bp-templates/", "") : pkgName;

        // To decide target folder, we temporarily unpack to a temporary dir to read its manifest.json
        const tmpTarget = path.join(fs.realpathSync(os.tmpdir()), `bp-install-${Date.now()}`);
        fs.mkdirSync(tmpTarget, { recursive: true });

        await client.install(pkgName, tmpTarget);

        // Read manifest.json from installed package to find backend
        const manifestPath = path.join(tmpTarget, "manifest.json");
        let backend = "claude"; // default fallback
        if (fs.existsSync(manifestPath)) {
          try {
            const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
            if (manifest && typeof manifest.backend === "string") {
              backend = manifest.backend;
            }
          } catch {
            // Ignore
          }
        }

        const finalTargetDir = path.join(getTemplatesRoot(), backend, cleanName);
        fs.mkdirSync(path.dirname(finalTargetDir), { recursive: true });

        // Move/copy to final location
        fs.cpSync(tmpTarget, finalTargetDir, { recursive: true });
        fs.rmSync(tmpTarget, { recursive: true, force: true });

        spinner.succeed(
          `Successfully installed template pack ${chalk.bold(pkgName)} under backend ${chalk.bold(backend)}!`
        );
        console.log(chalk.green(`  Location: ${path.relative(process.cwd(), finalTargetDir)}`));
        return;
      } catch (e) {
        spinner.fail(
          `Failed to install template pack: ${normalizeError(e).message}`
        );
        throw new BpError("Command failed", EXIT_CODES.GENERAL_ERROR, "CMD_ERROR", "");
      }
    });

  cmd
    .command("publish <path>")
    .description("Publish a custom template pack")
    .requiredOption("--name <name>", "Package name (e.g. @bp-templates/my-pack)")
    .requiredOption("--ver <version>", "Package version (e.g. 1.0.0)")
    .requiredOption("--private-key <key>", "Private key for signing")
    .option("--registry <url>", "Registry URL", "https://registry.npmjs.org")
    .option("--token <token>", "Auth token")
    .action(
      async (
        packPath: string,
        opts: { name: string; ver: string; privateKey: string; registry: string; token?: string }
      ) => {
        const spinner = ora(`Publishing template pack from "${packPath}"...`).start();
        try {
          const absolutePackDir = path.resolve(packPath);
          if (!fs.existsSync(absolutePackDir)) {
            spinner.fail(`Pack directory does not exist: ${absolutePackDir}`);
            throw new BpError("Template not found", EXIT_CODES.TEMPLATE_NOT_FOUND, "TEMPLATE_NOT_FOUND", "");
          }

          const client = new RegistryClient(opts.registry, opts.token);
          await client.publish(opts.name, opts.ver, absolutePackDir, opts.privateKey);

          spinner.succeed(
            `Successfully published template pack ${chalk.bold(opts.name)} (v${opts.ver})!`
          );
          return;
        } catch (e) {
          spinner.fail(
            `Failed to publish template pack: ${normalizeError(e).message}`
          );
          throw new BpError("Command failed", EXIT_CODES.GENERAL_ERROR, "CMD_ERROR", "");
        }
      }
    );

  return cmd;
}
