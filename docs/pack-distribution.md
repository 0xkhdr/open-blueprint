# 📦 Signed Pack Distribution

Stage 5 lets teams share rule packs, skill packs, and plugins under a verifiable
trust umbrella — **without any bp-hosted infrastructure**. Artifacts are signed,
content-addressed tarballs; the "registry" is a signed `index.json` served from
any static file host (S3, GitHub Pages, an artifact store, or a plain web server).

## Quick start (publisher)

```bash
# 1. Generate a signing keypair (private key written 0600 under ~/.bp/keys/)
bp pack keygen acme-platform

# 2. Publish a pack: validates it, builds the manifest, signs, writes the tarball
bp pack publish .bp/packs/security.bp-pack.yaml \
  --key ~/.bp/keys/acme-platform.pem \
  --out ./dist

# dist/ now contains:
#   security-1.0.0.bp-pack.tgz            ← the signed artifact
#   security-1.0.0.index-entry.json       ← snippet for the registry index

# 3. (Optional) Build a signed registry index from the published entries
bp pack index:build ./dist \
  --key ~/.bp/keys/acme-platform.pem \
  --base-url https://packs.acme.example

# dist/ now also contains index.json + index.sig — upload the whole dir.
```

Share `~/.bp/keys/acme-platform.pub` with consumers out-of-band (repo, wiki,
secret manager — anywhere you already establish trust).

## Quick start (consumer)

```bash
# 1. Trust the publisher's public key
bp trust add acme-platform ./acme-platform.pub

# 2. Install — signature and per-file hashes are verified before anything
#    touches your project
bp rule pack:install https://packs.acme.example/security-1.0.0.bp-pack.tgz
bp skill pack:install github:acme/governance@v2.1.0#dist/onboarding-2.1.0.bp-pack.tgz
bp pack plugin:install https://packs.acme.example/checker-1.0.0.bp-pack.tgz

# 3. Or point bp at the signed index and install by id
bp config set registry.url https://packs.acme.example/index.json
bp rule pack:install security
bp rule pack:search compliance
```

`bp trust list` / `bp trust remove <name>` manage the keyring
(`~/.bp/trust.json`).

## Artifact format

`<id>-<version>.bp-pack.tgz` is a gzipped tar containing:

| File | Content |
|---|---|
| `pack.yaml` | The `bp-pack/1` document (rule/skill packs) — plugin artifacts carry the `.mjs` bundle instead |
| `MANIFEST.json` | `{ schema: "bp-artifact/1", id, version, kind, files: [{path, sha256}], created_at, publisher }` |
| `MANIFEST.sig` | RSA-SHA256 hex signature over the canonical JSON (sorted keys, no whitespace) of `MANIFEST.json` |

The registry index (`index.json`) is
`{ schema: "bp-index/1", packs: [{id, version, kind, url, sha256, description?, tags?}] }`,
signed with a detached `index.sig` served alongside it.

## Trust model & threat model

**What signatures protect against**

- *Tampering in transit or at rest*: every file's sha256 must match the signed
  manifest; one flipped byte aborts the install with `PACK_HASH_MISMATCH`.
- *Impersonation*: `MANIFEST.sig` must verify against a key you explicitly
  added with `bp trust add`. A wrong or unknown key ⇒ `PACK_SIGNATURE_INVALID`.
- *Index poisoning*: the registry index itself is signed; an unverifiable index
  is rejected outright (there is no `--allow-unsigned` for indexes).
- *Path traversal*: extraction rejects absolute paths, `..` segments, symlinks,
  and hardlinks (`PACK_EXTRACT_UNSAFE`); everything is staged and verified
  before any project file is written, so failed installs leave no partial files.

**What signatures do NOT protect against**

- *A malicious-but-trusted publisher.* A signature proves who published, not
  that the content is benign. Review packs — and especially plugins, which
  execute code during `bp verify` — before trusting a key.
- *A compromised publisher key.* Rotate by removing the old key
  (`bp trust remove`) and adding a new one; revocation lists are documented
  future work.
- *Content-level issues.* That is the validator's job: every installed pack
  re-runs the full Stage 2/3 schema and bp validation. A correctly signed pack
  with an invalid rule schema still fails to install.

**Unsigned artifacts** are refused by default (`PACK_UNSIGNED`). Passing
`--allow-unsigned` prints a warning and records
`"trust": "unsigned-accepted"` in `.bp/packs.lock.json`, where Stage 6
reporting surfaces it. A *present-but-invalid* signature is never bypassable —
that is tamper evidence, not a missing feature. Plugins double down: unsigned
plugin installs additionally print the Stage 4 plugin trust warning, because
plugins execute code on your machine.

## Static-host registry recipe

1. `bp pack publish … --out ./dist` for each pack.
2. `bp pack index:build ./dist --key … --base-url https://your-host/packs`.
3. Upload `dist/` to any static host (S3 + CloudFront, GitHub Pages, Nginx…).
4. Consumers: `bp trust add` your public key, then
   `bp config set registry.url https://your-host/packs/index.json`.

GitHub refs (`github:owner/repo[@ref]#path/to/artifact.bp-pack.tgz`) resolve via
`raw.githubusercontent.com` and are subject to GitHub's unauthenticated rate
limits (~60 requests/hour per IP) — prefer a static host or release assets for
CI-scale consumption.

## CI recipe (pinned installs)

The lockfile records `artifact_sha256` for every remote install. In CI, pin it
so upstream changes can never slip in silently:

```yaml
# .github/workflows/governance.yml (excerpt)
- name: Install governance pack (pinned)
  run: |
    bp trust add acme-platform ./keys/acme-platform.pub
    bp rule pack:install https://packs.acme.example/security-1.0.0.bp-pack.tgz
    # Fail the build if the artifact drifted from the reviewed pin:
    grep '"artifact_sha256": "3f4c…your-pin…"' .bp/packs.lock.json
- name: Verify
  run: bp verify --level all
```

Alternatively commit `.bp/packs.lock.json`; `bp verify` flags missing/modified
pack files, and when `registry.url` is configured it adds an informational
`PACK_OUTDATED` finding when the index advertises a newer version. Set
`BP_OFFLINE=1` to skip that network lookup entirely.

## Plugins by artifact id

After `bp pack plugin:install`, reference the plugin from `.bp.json` by
artifact id instead of a raw path:

```json
{ "plugins": [{ "path": "artifact:remote-checker", "mode": "isolated" }] }
```

The id resolves through the lockfile to the installed bundle under
`.bp/plugins/<id>/`, which keeps plugin execution inside the project-root
containment guard from Stage 4.

## Limits & env vars

| Variable | Default | Description |
|---|---|---|
| `BP_PACK_MAX_BYTES` | `10485760` (10 MiB) | Max artifact size, both compressed download and decompressed contents. |
| `BP_PACK_TIMEOUT_MS` | `30000` | Fetch timeout per download. |
| `BP_OFFLINE` | *(unset)* | `1` disables the advisory registry-index lookup during `bp verify`. |
| `BP_REGISTRY_PUBLIC_KEY` | *(unset)* | Legacy single trusted key, folded into the keyring as `env:BP_REGISTRY_PUBLIC_KEY`. |
| `BP_HOME` | `~/.bp` | Overrides the bp home directory (trust store, keys, user config). |

Only `https://` URLs are fetched (plain `http` is tolerated for loopback hosts
to support local testing); redirects are re-checked per hop and capped at 5.

## Non-goals

No hosted central registry, accounts, or payments. Key rotation beyond
"remove key from keyring" and revocation lists are documented future work.
