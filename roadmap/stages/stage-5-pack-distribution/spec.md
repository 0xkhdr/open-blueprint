# Stage 5 — Signed Pack Distribution (Rules, Skills, Plugins)

Closes **GAP-5** (`roadmap/00-analysis.md`): the registry client is mock-only and the
RSA signer is unused. This stage lets clients share rule packs, skill packs, and plugins
under a verifiable trust umbrella: signed artifacts, explicit trust policy, install from
URL or git, while keeping bp's zero-infrastructure character (no bp-hosted registry
required — any static file host works).

**Depends on Stages 2–3** (pack format/lockfile) and **Stage 4** (plugin packages).

## Goals

1. `bp pack publish` produces a signed, content-addressed archive of a pack (or plugin).
2. `bp rule|skill pack:install <https-url | git-ref | path>` verifies signature + hash
   against the local trust policy before materializing.
3. Trust policy is explicit, local, and fail-loud: unsigned/unknown-key installs require
   an explicit `--allow-unsigned` decision recorded in the lockfile.
4. Static-host "registry": a signed `index.json` any team can serve (S3, GitHub Pages,
   artifact store) and point bp at.

## Non-goals

- Hosted central registry, accounts, payments. Key rotation/revocation lists beyond
  "remove key from keyring" (documented future work).

## Design

### 1. Artifact format

`<id>-<version>.bp-pack.tgz` containing:

```
pack.yaml            # the bp-pack/1 (or /2 with skills) document
MANIFEST.json        # { schema:"bp-artifact/1", id, version, kind, files:[{path,sha256}], created_at, publisher }
MANIFEST.sig         # RSA-SHA256 hex over canonical-JSON MANIFEST.json (existing signer.ts)
```

Plugin artifacts: same envelope, `kind: "plugin"`, files = the `.mjs` bundle.
Canonical JSON = sorted keys, no whitespace (implement `canonicalJson()` in
`src/registry/canonical.ts`, property-test stability).

### 2. Trust policy (`~/.bp/trust.json`, Zod-schema'd; `src/registry/trust.ts`)

```jsonc
{
  "schema": "bp-trust/1",
  "keys": [ { "name": "acme-platform", "publicKeyPem": "...", "added_at": "..." } ],
  "policy": { "require_signature": true }   // default true
}
```

- `bp trust add <name> <pubkey.pem>` / `bp trust list` / `bp trust remove <name>`
  (new `src/cli/commands/trust.ts`).
- Existing `loadPublicKey()` in `signer.ts` folds into this keyring (multi-key).
- Verification: MANIFEST.sig must verify against any trusted key; every file's sha256
  must match MANIFEST. Failure ⇒ `PACK_SIGNATURE_INVALID` / `PACK_HASH_MISMATCH`,
  install aborted, partial files cleaned up.
- `--allow-unsigned` bypass: prints a clear warning, records
  `"trust": "unsigned-accepted"` in the lockfile entry (Stage 6 reporting surfaces it).

### 3. Publishing (`bp pack publish <packfile> --key <private.pem> [--out dir]`)

Validate pack (Stage 2/3 schema) → build MANIFEST → sign → write tarball + detached
`index-entry.json` snippet. `bp pack keygen` wraps `generateKeyPair()` writing to
`~/.bp/keys/` (0600 perms on private key; refuse overwrite).

### 4. Remote install sources (`src/registry/client.ts` rewrite)

Replace mock with:
- `https://` URL ⇒ fetch tarball (Node `fetch`; size cap `BP_PACK_MAX_BYTES` default
  10 MiB; timeout 30 s; no redirects to non-https).
- `github:owner/repo[@ref][#path]` ⇒ resolve via raw.githubusercontent /
  codeload tarball (document rate limits).
- Local path (existing Stage 2 behavior).
- Registry index: `bp config set registry.url https://host/index.json`;
  `index.json` = `{ schema:"bp-index/1", packs:[{id,version,kind,url,sha256,description,tags}] }`,
  itself signed (`index.sig` alongside). `pack:search`/`pack:install <id>` consult it.

Keep the mock behind `BP_REGISTRY_MOCK=1` for unit tests. Extraction safety: reject
absolute paths, `..`, symlinks, and files outside the staging dir (zip-slip guard);
extract to temp dir, verify, then materialize via Stage 2/3 pipeline (which re-runs
all schema + bp validation — distribution never bypasses validation).

### 5. Lockfile additions

Lock entries gain `source` (url/git/path/registry), `artifact_sha256`, `publisher`,
`trust` (`signed:<keyname>` | `unsigned-accepted`). `bp verify` pack-integrity check
(Stage 2 §6) compares installed content hash and flags upstream drift when the
registry index advertises a newer version (`PACK_OUTDATED` info).

### 6. Plugins distribution

`.bp.json` plugin entries may reference an installed plugin artifact id instead of a
raw path; install flow identical; unsigned plugins additionally require
`--allow-unsigned` AND print the Stage 4 trust warning (plugins execute code — say so).

### 7. Docs

New `docs/pack-distribution.md`: publish walkthrough, trust model + threat model
(what signatures do/don't protect against), static-host registry recipe, CI recipe
(install packs in CI with pinned `artifact_sha256`). Update `docs/commands.md`,
`docs/configuration.md` (registry.url), rewrite `docs/template-authoring.md`'s
signing section to match reality.

## Acceptance criteria

1. Round trip on one machine: `keygen` → `pack publish` → serve dir over local http
   (test server) → `trust add` → `pack:install <url>` succeeds; tampering 1 byte in the
   tarball ⇒ `PACK_HASH_MISMATCH`; wrong key ⇒ `PACK_SIGNATURE_INVALID`; both abort
   cleanly (no partial files).
2. Unsigned install fails by default; `--allow-unsigned` succeeds with warning and
   lockfile `trust: "unsigned-accepted"`.
3. Zip-slip fixture (entry `../../evil`) is rejected.
4. Installed remote pack flows through full bp validation (a pack with an invalid rule
   schema fails install even when correctly signed).
5. `npm run ci` green; mock registry only active under `BP_REGISTRY_MOCK=1`.

## Test plan

- Unit: canonical JSON stability (fast-check), trust store CRUD, signature/hash
  verification matrices, extraction guards, URL scheme/size/timeout limits.
- Integration: local http server fixture serving signed + tampered + unsigned
  artifacts and a signed index.json; full install lifecycle incl. lockfile assertions.
