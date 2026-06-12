/**
 * Filesystem locations for the local bp home (`~/.bp`).
 *
 * Lives in its own module so `signer.ts` and `trust.ts` can both depend on it
 * without depending on each other (this file broke the only runtime
 * import cycle in the codebase, signer ↔ trust).
 */

import * as os from "node:os";
import * as path from "node:path";

/** Base bp home directory; `BP_HOME` overrides for tests and sandboxes. */
export function bpHome(): string {
  return process.env.BP_HOME ?? path.join(os.homedir(), ".bp");
}

export function trustStorePath(): string {
  return path.join(bpHome(), "trust.json");
}

export function keysDir(): string {
  return path.join(bpHome(), "keys");
}
