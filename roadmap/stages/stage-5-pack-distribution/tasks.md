# Stage 5 Tasks — Signed Pack Distribution

Prereqs: Stages 2, 3, 4 merged. Keep `npm run ci` green per group.

## 1. Canonical JSON & artifact format

- [ ] 1.1 Create `src/registry/canonical.ts` `canonicalJson()`; fast-check stability tests.
- [ ] 1.2 Artifact builder `src/registry/artifact.ts`: build/read `bp-artifact/1` tarball (pack.yaml, MANIFEST.json, MANIFEST.sig); per-file sha256.
- [ ] 1.3 Extraction guards: reject absolute paths, `..`, symlinks, outside-staging writes; temp-dir staging; tests incl. zip-slip fixture.

## 2. Trust store & keys

- [ ] 2.1 Create `src/registry/trust.ts`: `~/.bp/trust.json` Zod schema, multi-key keyring, fold in `loadPublicKey()`.
- [ ] 2.2 `bp trust add|list|remove` (`src/cli/commands/trust.ts`, register in CLI index).
- [ ] 2.3 `bp pack keygen` (0600 private key, no-overwrite); verification helpers: `PACK_SIGNATURE_INVALID` / `PACK_HASH_MISMATCH` errors with cleanup.
- [ ] 2.4 Unit tests: CRUD, multi-key verify, tamper matrix.

## 3. Publish

- [ ] 3.1 `bp pack publish <packfile> --key … [--out]`: validate via pack schema, build manifest, sign, write tarball + index-entry.json.
- [ ] 3.2 Tests: publish→read-back→verify round trip.

## 4. Remote install

- [ ] 4.1 Rewrite `src/registry/client.ts`: https fetch (size cap, timeout, https-only redirects), `github:` resolver, signed `index.json` support; mock behind `BP_REGISTRY_MOCK=1`.
- [ ] 4.2 Wire `pack:install <url|github:…|id>` and `pack:search` through client → verify → existing Stage 2/3 materialization (full validation re-run).
- [ ] 4.3 `--allow-unsigned` flow: default-deny, warning, lockfile `trust: "unsigned-accepted"`.
- [ ] 4.4 Lockfile additions: source, artifact_sha256, publisher, trust; `PACK_OUTDATED` info in pack-integrity check when index advertises newer.
- [ ] 4.5 Integration tests against local http test server: signed/tampered/unsigned/index flows; clean abort leaves no partial files.

## 5. Plugin artifacts

- [ ] 5.1 `kind: "plugin"` artifact support; `.bp.json` plugin entry by installed artifact id; unsigned-plugin double-gate (flag + trust warning).
- [ ] 5.2 Integration test: install signed plugin artifact, runs in verify.

## 6. Docs & wrap-up

- [ ] 6.1 Write `docs/pack-distribution.md` (publish, trust/threat model, static-host registry, CI pinning recipe).
- [ ] 6.2 Update `docs/commands.md`, `docs/configuration.md`; align `docs/template-authoring.md` signing section with reality.
- [ ] 6.3 Confirm acceptance criteria 1–5; `npm run ci` green.
