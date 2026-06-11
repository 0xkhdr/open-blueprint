/**
 * Shared CLI flow for installing Stage 5 remote pack artifacts from the
 * `bp rule pack:install` / `bp skill pack:install` commands.
 */

import chalk from "chalk";
import type { ArtifactKind } from "../registry/artifact.js";
import { resolveBackendManifest } from "./resolve-backend.js";

export interface ArtifactInstallCliOptions {
  force?: boolean;
  dryRun?: boolean;
  allowUnsigned?: boolean;
}

export async function installArtifactRef(
  ref: string,
  expectKind: ArtifactKind,
  options: ArtifactInstallCliOptions
): Promise<void> {
  const { installRemoteArtifact } = await import("../registry/install.js");
  const cwd = process.cwd();
  const manifest = await resolveBackendManifest(cwd);

  const result = await installRemoteArtifact(ref, {
    projectRoot: cwd,
    manifest,
    force: options.force ?? false,
    dryRun: options.dryRun ?? false,
    allowUnsigned: options.allowUnsigned ?? false,
    expectKind,
  });

  if (result.unsignedAccepted) {
    console.warn(
      chalk.yellow.bold("⚠ WARNING: this artifact is UNSIGNED — its publisher cannot be verified.")
    );
    console.warn(chalk.yellow('  Recorded in the lockfile as trust: "unsigned-accepted".'));
  }

  const verb = options.dryRun ? "[dry-run] Would install" : "Installed";
  console.log(
    chalk.green(`✓ ${verb} pack '${result.id}' v${result.version} from ${result.source}`)
  );
  console.log(`  Trust:  ${result.trust}`);
  console.log(`  sha256: ${result.artifactSha256}`);

  const materialize = result.materialize;
  if (materialize) {
    for (const f of materialize.written) console.log(chalk.green(`  + ${f}`));
    for (const f of materialize.skipped) console.log(chalk.dim(`  = ${f} (kept existing)`));
    for (const f of materialize.conflicts)
      console.warn(chalk.yellow(`  ! ${f} belongs to another pack or is hand-written; skipped`));
  }
  if (!options.dryRun) console.log(chalk.dim("  Lockfile updated: .bp/packs.lock.json"));
}
