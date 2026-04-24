# Bundle Spec — Scoping checklist (Phases 1–5)

Contract source: `DE_FAKE_IMPLEMENTATION_PLAN.md` (four-phase §4 from PR #6 plan).

This doc tracks the work for the `claude/bundle-spec-phase-1-contract` branch and downstream phases. Each row maps to a plan anchor so a reviewer can confirm scope against the canonical plan without inference.

---

## Phase 1 — Contract + spec API + YAML + MTP (server only)

Plan anchors: §2.1 manifest/distribution, §2.2 MTP, §2.4 memory rules, §2.5 API hardening, §2.8 typed YAML, §2.9 tests, §3 HTTP API, §4 Phase 1 table, §A.10 file checklist.

| # | Deliverable | Files | Done when |
|---|-------------|-------|-----------|
| 1 | Zod `BundleSpec` + `bundleTier` + manifest shape per §A.4 | `lib/server/bundle-spec/schema.ts` | `validate` rejects unknown `memory` keys, tier/suffix mismatch, device-class/VRAM combos |
| 2 | Zod `BundleSpecInput` (userRequest, llmResponse, bundleTier, contexts) | `lib/server/bundle-spec/input-schema.ts` | Route `safeParse` uses it |
| 3 | `generateBundleSpec(input)` draft emitter (profile_id = `"draft"`, bundle_tier from input) | `lib/server/bundle-spec/service.ts` | Draft manifest passes schema; tier-appropriate memory floors |
| 4 | Typed YAML/JSON emit for manifest, roles, prefixes, MTP (`chat_messages`) | `lib/server/bundle-spec/yaml.ts` | Round-trip + snapshot tests pass |
| 5 | `ApiErrorBody` / error mapper with 413 (512 KiB cap) + 504 (10s wall) support | `lib/server/http/errors.ts` | Body > 512 KiB → 413; handler > 10s → 504 |
| 6 | `POST /api/bundle-spec` route: zod parse, `x-request-id`, body cap, timeout | `app/api/bundle-spec/route.ts` | 400/413/504 tests green; happy path returns manifest + roles + prefixes |
| 7 | MTP v1 contract doc: concat order, delimiters, NFC, `apply_chat_template`, no guided decoding | `docs/mtp-prefix-v1.md` | Doc merged; referenced from plan |
| 8 | `buildPrompt(role, session)` pure fn (matches §A.13 I/O) | `lib/server/bundle-spec/mtp.ts` | Token-prefix golden tests stable across calls |
| 9 | Tier draft smoke — for each `S/M/L/XL`, service produces valid draft with matching bundle_tier and memory floors | `lib/server/bundle-spec/tier-smoke.test.ts` | CI green on all four tiers |

**Out of scope for Phase 1:** dropper, bundles.json, signing, agent-runtime, vLLM, Agent.app. No build_jobs, no Postgres — those are not in the §4 table.

**Deferred cleanup (follow-up PR, not this one):** once `claude/implement-phases-0-1-Yhmf3` (441f3d9, agent-spec hardening) lands on main, dedupe `lib/server/http/errors.ts` so bundle-spec and agent-spec share the same envelope. Until then both routes use the helper independently — no pre-emptive abstraction.

---

## Phase 2 — Dropper + `bundles.json` + install UX

Plan anchors: §2.3 dropper + stage-2, §A.3 bundles.json + selection, §A.6 dropper CLI, §A.11 size gate, §2.6 release gate.

| # | Deliverable | Surface | Done when |
|---|-------------|---------|-----------|
| 1 | `bundles.json` Zod schema + canonical fixture (tiered `profile_id`s, Ed25519 signature field) | `lib/server/bundle-index/*`, fixtures | Fixture verifies; missing signature rejected |
| 2 | Dropper CLI per-OS (<5 MB release binary): Win WinHTTP, macOS NSURLSession, Linux libcurl | `packages/agent-setup/*` (new) | `wc -c < dist/agent-setup` < 5 * 1024 * 1024 |
| 3 | `--tier` / `AGENT_BUNDLE_TIER` selection + §A.3 deterministic algorithm | Same | Probe matrix fixtures pick correct `profile_id` per tier |
| 4 | Download → SHA256 verify → detached signature verify → unpack → atomic rename | Same | Corrupt archive → fail before unpack; resume works |
| 5 | GUI fatal/success paths; Documents junction + folder open; `--headless` | Same | Manual checklist signed off; `--headless` suppresses all GUI |
| 6 | Offline install flags (`--bundle-path`, `--index-file`) + sidecar `.sha256` | Same | Integration test: airgap install without network |

---

## Phase 3 — Stage-2 runtime (`agent-runtime`)

Plan anchors: §2.1 install root, §2.3.2 stage 2, §2.4 memory runtime behaviors, §2.10 first-run, §2.7 uninstall/updates, §A.2 directory tree, §A.12 vLLM child, §A.13 MTP router.

| # | Deliverable | Surface | Done when |
|---|-------------|---------|-----------|
| 1 | Install-root resolution (+ macOS `Agent.app` layout); realpath no-escape rule | `packages/agent-runtime/*` | Path traversal tests reject `..` after realpath |
| 2 | vLLM child bound `127.0.0.1:8000`; router `8765`; metrics `8766`; bind-fail → exit 9 | Same | Ports observable in integration smoke |
| 3 | `FILES.sha256` verify before start | Same | Tampered file → exit before vLLM |
| 4 | MTP `buildPrompt` (router) — chat_messages only | Same | Integration test hits APC warm on 2nd call |
| 5 | Admission 429 (`CAPACITY`), token 413, preflight RAM/VRAM floor → exit 8 | Same | HTTP + unit tests |
| 6 | `/setup` wizard + `user_config.json` + OS keychain integration (Keychain / Credential Manager / libsecret) | Same | Secrets not in plaintext; `/setup` gates `/v1/*` until written |
| 7 | Windows rename-in-use update pattern (not “stop first”) | Same | Locked exe update test |
| 8 | `agent-runtime uninstall` — root must contain `manifest.json` | Same | Refuses arbitrary paths |

---

## Phase 4 — Release matrix + CI gates

Plan anchors: §4 Phase 4 table, §5 DoD, §8 signing, §2.6 release gate, §A.11 size gate.

| # | Deliverable | Surface | Done when |
|---|-------------|---------|-----------|
| 1 | Packer builds `.tar.zst` per `{os-gpu-tier}` cell (min: M across shipped OS/GPU) | `.github/workflows/*`, `scripts/*` | Each shipped cell has signed index row |
| 2 | Unpacked-size gate: S ≤ 300 MB, M ≤ 3 GB, L ≤ 12 GB, XL ≥ declared floor | CI | S exceeds → build fails |
| 3 | Authenticode (Win), Developer ID + notarize + staple (macOS), optional GPG (Linux) | CI + scripts | Release checklist complete |
| 4 | Optional GPU APC warm smoke (one M or L profile) | Optional CI job | Green when GPU runner available |

---

## Phase 5 — GA / handoff

Plan anchors: §2.7 (uninstall/updates), §5 (DoD), §2.3.3 (UX), §2.6 (gate checklist).

| # | Deliverable | Surface | Done when |
|---|-------------|---------|-----------|
| 1 | Operator runbook: install, upgrade, rollback, tier switch, `LAST_ERROR.txt` support flow | `docs/runbook-bundle.md` | Merged; linked from README |
| 2 | Deprecation note for `POST /api/agent-spec`: dual-doc period, redirect-or-cut date | `docs/deprecation-agent-spec.md` | Merged |
| 3 | Release checklist: bump `bundle_schema_version`, sign `bundles.json`, CDN row-count sanity | `docs/release-checklist.md` | Merged |
| 4 | Smoke matrix table: OS × tier × role (required vs optional cells) | `docs/smoke-matrix.md` | Merged; referenced by CI |
| 5 | One “full path” scripted smoke: fixture index → dropper fake → runtime stub | `scripts/smoke-full-path.sh` | Runs in CI on Linux; passes |

Phase 5 adds no product features — docs + checklists + one scripted smoke only.

---

## Cross-phase notes

- **Frozen v1 choices** (§ "Frozen product choices"): trust them; do not reopen ADRs in code without a plan-doc change first.
- **Portability invariant:** `agent-runtime` never writes absolute paths into anything a user copies — verified by Phase 3 path-traversal tests.
- **No training / no supernode in v1.** If a Phase 1 helper looks like it's re-creating that, stop and delete.
- **Spec-server drafts only.** Production `profile_id` is injected by the packer in Phase 4, never by this repo's Next app.
