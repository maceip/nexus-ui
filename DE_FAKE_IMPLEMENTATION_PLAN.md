# De-Fake Implementation Plan

## Purpose

This plan replaces prototype behavior with a **production-grade, self-sufficient runtime** that runs **entirely on the user’s machine**. There is **no remote training service**, **no supernode**, **no thin-client control plane**, and **no required third-party runtime** (Docker, Podman, Kubernetes, etc. are **out of scope as dependencies**—the shipped product must be **copy-paste portable**).

**Vendored Python is allowed and expected when vLLM requires it:** the portable tree may include a **pinned, read-only Python runtime** (stdlib + wheels) used only by the shipped stack. The user must **not** install Python, `pyenv`, or `pip` on the host—that is what “self-sufficient” means. The **entrypoint** remains a **native launcher** (or platform equivalent); it may exec the vendored interpreter as an implementation detail.

### Portability invariant (non-negotiable)

- **Stage 1 — Dropper** (per OS): a **native** binary **under 5 MB** (release budget; CI should assert size) that **probes** OS version, CPU arch, GPU/Metal availability (macOS), CUDA/driver floor (Windows/Linux where applicable), and free disk space. It then **downloads and verifies** (TLS, signatures, SHA256, resume) the **Stage 2** artifact for that profile—e.g. on macOS: **Metal-capable vLLM/runtime bundle** when probes pass; otherwise a **fallback** bundle (CPU or older macOS) documented in the bundle index.
- **Stage 2 — Full bundle**: large portable tree (weights + vendored Python + `agent-runtime` + manifest, etc.). Same copy-anywhere semantics **after** materialized under a stable install dir (e.g. `%LOCALAPPDATA%\...` / `~/Library/Application Support/...` / `$XDG_DATA_HOME/...`—exact paths in product doc).
- The user may **email only the dropper** or host a **small** link; the **60 GB+** payload arrives in stage 2 only when needed. They can still **thumb-drive the fully materialized** stage-2 tree for air-gapped machines (dropper optional there if offline install path exists).
- **No** `docker pull`, **no** user-installed Python for either stage.
- **Optional**: developers may use Docker **internally** for CI; that must never appear in end-user documentation as a requirement.

The core runtime idea is the **Multi-Tenant Prefix (MTP) architecture**: several **roles** share **one loaded model** and are distinguished by **structured, stable prompt prefixes** per role. That maximizes **Automatic Prefix Caching (APC)** in **vLLM** so switching roles reuses KV for shared prefixes—**without reloading weights**.

References (external, for implementers):

- vLLM Automatic Prefix Caching: https://docs.vllm.ai/en/latest/features/automatic_prefix_caching/
- APC is enabled via `enable_prefix_caching=True` (Python) or `--enable-prefix-caching` (CLI), subject to the **pinned** vLLM version in `manifest.json`.

This document explicitly addresses:

1. **Two-stage distribution** — per-platform **dropper** binary (**< 5 MB**) that probes the machine, then downloads the correct **full runtime bundle** (e.g. macOS **Metal** vLLM build when supported; otherwise a documented fallback; **Windows** bundle on Windows; Linux variant on Linux).
2. **Portable full bundle** + **self-sufficient runtime** (manifest, roles, prefixes, tools, model pin, optional vendored Python).
3. **MTP + vLLM APC** — prefix design, router/skill model, observability, APC security notes.
4. **Smart memory management** — GPU/CPU budget, cache pools, backpressure, spill/eviction, graceful degradation.
5. **Hardened API contract** for the **spec server** (this Next app) that emits bundle manifests.
6. **Typed YAML serialization** + contract tests.
7. **Integration tests** proving droppers and full bundles (not script stubs) and, where CI has a GPU, APC-friendly behavior.

### Frozen product choices (v1 — normative)

These are **binding** for the first shippable vertical slice. Do not add parallel formats or “v2 hooks” in the same artifact family without bumping `index_schema_version` / `bundle_schema_version`.

| Topic | v1 decision |
|-------|-------------|
| **Stage-2 archive** | **`.tar.zst` only** (Zstandard). No `.zip` / `.tar.gz` in v1. `distribution.stage2_archive_format` is always `"tar.zst"`. |
| **Index + artifact crypto** | **Ed25519** only. Index carries **required** `signing_key_id`, `index_signature_algorithm` (`ed25519`), `index_signature_b64`. Each profile carries **required** `stage2_detached_signature_b64` **embedded in the index** (base64 signature bytes)—**no second HTTPS fetch** for stage-2 sig in v1. (CDN may still ship `.sig` sidecar for humans; dropper **must not depend** on it.) |
| **Signed bytes (index)** | Payload = UTF-8 **`canonical_json(signing_object)`** where `signing_object` is exactly `{ "channel", "index_schema_version", "profiles", "released_at" }` with **`profiles` sorted ascending by `profile_id`** and each profile object’s keys **sorted ASCII ascending**. `canonical_json` = JSON with **no insignificant whitespace**, UTF-8, no trailing newline. Signature covers those bytes end-to-end. |
| **Signed bytes (stage-2)** | Message = UTF-8 string **exactly** `"{profile_id}\n{stage2_archive_sha256}\n{stage2_archive_bytes}\n"` (trailing newline mandatory). Sign with **same** Ed25519 key type; verify before unpack. |
| **TLS** | **System CA trust store only.** **No** TLS public-key pinning in v1 (avoids dead installs behind corporate SSL inspection). |
| **Dropper second instance** | If `install_parent/install.lock` exists and PID alive → **exit 6 immediately** (no wait queue). |
| **Windows in-place update** | **Versioned dirs** `versions/<semver>/` + **`current` junction**. If `agent-runtime` is running from `current`, **`agent-setup install` exits 7** with message to run `agent-runtime stop` first (no forced kill from dropper). |
| **Linux `min_os_version`** | Compare to **`VERSION_ID`** from **`/etc/os-release`** (strip quotes). If file missing or `VERSION_ID` missing → **no Linux profile matches** (exit 3). Do **not** use kernel `uname` for OS floor in v1. |
| **macOS `min_os_version`** | Compare to **`sysctl kern.osproductversion`** string (e.g. `14.2.1`): split `.`, zero-pad numeric tuple, lexicographic ≥. |
| **Windows `min_os_version`** | String **`10.0.19045`** form (major.minor.build): compare using **RtlGetVersion**-equivalent (`osversion` struct): require **each component ≥** parsed minimum (build number required in v1 rows). |
| **MTP serialization** | **`chat_messages` only** for v1 (`manifest.mtp.serialization_mode` literal). No raw-string mode. |
| **Guided decoding** | **None in v1** (no GBNF / JSON-schema sampler constraints in role definitions). Eliminates “APC vs grammar” undefined behavior until v2. |
| **Unicode** | All prefix files **UTF-8 NFC** at rest; reject non-NFC on `validate`. |
| **Integrity file** | **`FILES.sha256` required** in every shipped stage-2 tree; `validate` fails if missing. |
| **WSL / devcontainers** | **Unsupported** in v1 (document in README; CI does not test). |
| **Metal pipeline** | v1 **requires** a **working Metal-capable vLLM build** in `macos-metal` profile or that profile is **omitted from index** (ship only `macos-fallback`). The plan does not assume upstream readiness—**release index lists only profiles you have built**. |
| **Spec server vs release manifest** | Next app emits **`distribution.profile_id`: `"draft"`** only. Release packer **overwrites** to real `profile_id` and injects **`bundle_schema_version`** / hashes—**never** publish CDN artifacts straight from Next without packer pass. |

---

## 0) Codebase Inventory (Today)

| Area | Path | Notes |
|------|------|-------|
| Agent spec schema | `lib/server/agent-spec/schema.ts` | Evolve toward `BundleSpec` / portable runtime contract |
| Spec generation | `lib/server/agent-spec/service.ts` | Replace with bundle + MTP emitters |
| YAML | `lib/server/agent-spec/yaml.ts` | Typed serializer |
| HTTP API | `app/api/agent-spec/route.ts` | Add zod + error envelope |
| Architecture | `ARCHITECTURE_AGENT_SPEC.md` | Keep aligned with this plan |
| E2E | `scripts/e2e-agent-binaries.sh` | Replace stub with portable-binary / bundle smoke |

---

## 0.1) Gaps to Remove (Revised)

- Fake training, supernode, thin client (same as prior revision).
- **Any hard dependency on Docker/OCI** for running the agent.
- Script-as-binary E2E; replace with **verified native** launcher + bundle layout.
- **Naive memory defaults**: shipping vLLM without explicit **GPU budget**, **max concurrency**, and **prefix-cache / KV eviction policy** guarantees poor UX on 12–16 GB cards.

---

## 1) Target Architecture

### 1.0 Two-stage distribution (dropper → full bundle)

| Stage | Artifact | Size (target) | Role |
|-------|-----------|---------------|------|
| **1** | `agent-setup.exe` / `Agent Setup` / `agent-setup` | **< 5 MB** per platform | Probe machine; resolve **bundle channel** (macOS Metal vs fallback, Windows, Linux); HTTPS download with verify + resume; unpack; optionally register shortcut / PATH; launch or delegate to stage 2 |
| **2** | Full portable directory or signed archive | Large (GB–60 GB+) | Self-sufficient runtime: `agent-runtime`, vendored Python if needed, vLLM build **matched to probe** (Metal on Apple GPU path, etc.), manifest, roles, weights per product policy |

**macOS branch:** index must list **`macos-metal`** (priority **10**) with `requires_metal: true` and **`macos-fallback`** (priority **100**) with `requires_metal: false`; selection algorithm (§A.3) picks **`macos-metal`** iff Metal + OS predicates pass, else **`macos-fallback`**. If `macos-metal` row is absent from CDN, Metal Macs fall through to fallback only—**do not ship that accidentally**; omit metal row only when no Metal build exists.

**Windows branch:** download **`bundle-windows-…`** (CUDA variant vs CPU-only may use the same probe pattern: NVIDIA driver present → CUDA bundle; else CPU or fail with clear message).

**Bundle index:** dropper fetches a **signed** channel document (default name `bundles.json`; treat as **schema-versioned** JSON, not ad hoc). Normative fields are in **§1.0.1** so implementers do not invent incompatible shapes.

**Linux branch:** same two-stage pattern: **`bundle-linux-cuda-…`** vs **`bundle-linux-cpu-…`** (or `rocm` if you ship it)—probe selects **exactly one** row; document unsupported GPU → fail-fast vs CPU fallback in product policy (must be explicit in index, not undefined).

#### 1.0.1 Bundle channel index — normative contract (`bundles.json`)

The index is the **source of truth** for URLs and hashes; the dropper must **never** trust CDN directory listings alone.

| Field | Required | Meaning |
|-------|----------|---------|
| `index_schema_version` | yes | Integer; **must** be ≤ dropper’s embedded `max_supported_index_schema`; dropper refuses unknown majors (forward-compat) |
| `channel` / `product_id` | yes | Stable string; e.g. `nexus-agent` |
| `released_at` | yes | ISO-8601; used for staleness warnings only |
| `signing_key_id` | yes | Must match one of the dropper’s embedded pubkey ids |
| `index_signature_algorithm` | yes | Literal **`ed25519`** |
| `index_signature_b64` | yes | Ed25519 signature over **`canonical_json(signing_object)`** per **Frozen product choices** table (signing object keys: `channel`, `index_schema_version`, `profiles`, `released_at` only) |
| `profiles[]` | yes | One object per selectable stage-2 artifact |

Each **`profiles[]`** entry:

| Field | Required | Meaning |
|-------|----------|---------|
| `profile_id` | yes | Stable id: `macos-metal`, `macos-fallback`, `windows-cuda`, `windows-cpu`, `linux-cuda`, `linux-cpu`, … |
| `bundle_schema_version` | yes | Semver of **`manifest.json` inside** this stage-2 archive; used for **downgrade detection** before download |
| `selection_priority` | yes | Integer **≥ 0**; **lower value = higher priority**. After filtering to rows whose predicates pass, pick the **passing row with minimum `selection_priority`**; tie-breaker lexicographic `profile_id`. **Without this field, multiple rows can match one machine** (e.g. fallback and metal both “pass” if `requires_metal` is only one-way)—do not ship an index without priorities |
| `stage2_archive_url` | yes | HTTPS URL to **one** `.tar.zst` file (v1 only) |
| `stage2_archive_sha256` | yes | Hash of the **entire** archive file on disk after download (before unpack) |
| `stage2_archive_bytes` | yes | Exact byte length; dropper rejects download if `Content-Length` (if present) mismatches or final size ≠ this |
| `stage2_unpacked_min_bytes` | yes | **Minimum free disk** required before download starts (compressed + peak unpack temp; be conservative) |
| `min_os_version` / `max_os_version` | yes / optional | Inclusive semver or platform-specific tuples (e.g. mac `14.0+`); **probe must implement same comparator** as CI fixtures |
| `cpu_arch` | yes | `arm64` \| `x86_64` \| `universal` (if ever used—define semantics) |
| `requires_metal` | optional | If **true**, host must pass Metal probe. If **false**, no constraint (host may or may not have Metal)—**therefore** fallback rows **must** use higher `selection_priority` than `macos-metal` so Metal machines still pick metal first |
| `requires_no_metal` | optional | If **true**, host must **fail** Metal probe (CPU-only / software-render path)—use for explicit CPU bundles on macOS when you must exclude Metal-capable hosts |
| `requires_cuda` | optional | If true, NVIDIA driver + capability probe passes |
| `min_dropper_version` | optional | Reject if dropper too old to verify this profile’s format |
| `stage2_detached_signature_b64` | yes | Ed25519 signature over the **stage-2 message** per **Frozen product choices** (same key type as index; key id in `signing_key_id`) |
| `release_notes_url` | optional | Human-readable |

**Key rotation:** dropper embeds a **fixed map** `pubkeys: Record<signing_key_id, ed25519_public_key_bytes>` (≤4 keys). Index `signing_key_id` selects the verify key. Revoke old keys by shipping new dropper before CDN stops signing with old key.

#### 1.0.2 Dropper bootstrap URL (resolve chicken-and-egg)

The dropper must know **where to fetch the first index** without user pasting a 60 GB URL. Define **in priority order**:

1. **CLI / env**: `--index-url`, `AGENT_BUNDLE_INDEX_URL` (highest for IT deployments).
2. **Embedded default** in binary: `https://cdn.example.com/.../bundles.json` (product CDN).
3. **Sidecar file** next to dropper: `bundles.index.url` one line (for thumb-drive enterprise mirrors).

If all missing → exit with **actionable** error (exit code documented). **No** silent fallback to hardcoded third-party URLs not owned by the vendor.

### 1.1 Conceptual model (after stage 2 is installed)

```
┌──────────────────────────────────────────────────────────────────┐
│  Full portable install (stage 2 — copy anywhere once materialized)│
│  ├── agent-runtime          # native launcher / router             │
│  ├── manifest.json         # pins model, vLLM args, memory policy │
│  ├── roles/  prefixes/  tools/                                   │
│  └── models/               # weights (+ optional further downloads)│
└──────────────────────────────────────────────────────────────────┘
         │
         │  agent-runtime: Skill Router + memory governor + tool host
         ▼
┌────────────────────────────┐
│  vLLM (build matched to    │  enable_prefix_caching = true
│   probe: Metal / CUDA /…)  │  one model load for MTP roles
└────────────────────────────┘
```

- **Skill Router** (inside `agent-runtime`): maps events to `role_id`, composes MTP prompts, applies **memory policy** before calling vLLM.
- **One weight load**; role changes are **prefix changes**, not model swaps.

### 1.2 Control plane (server-side, this repo)

| Component | Responsibility |
|-----------|------------------|
| **BundleSpec API** | Validate inputs; emit `manifest.json`, roles, prefixes, YAML |
| **Build Orchestrator** (optional SaaS) | Build **droppers** (<5 MB) and **stage-2** archives per profile (`macos-metal`, `macos-fallback`, `windows-…`, `linux-…`); publish signed `bundles.json` + CDN objects |

**Not required to run the agent:** Postgres, Redis, object storage—only if you operate a **build service** or CDN for downloads.

### 1.3 Data plane (portable runtime)

| Piece | Responsibility |
|-------|----------------|
| **Dropper** (stage 1) | Tiny signed binary: probe, select bundle, download, verify, install dir, hand off |
| **Native `agent-runtime` binary** (stage 2) | Router, memory governor, optional embedded HTTP for local “watcher” clients |
| **vLLM** | Build **selected by dropper** (Metal / CUDA / CPU per profile); pinned inside stage 2 (see §8) |
| **Tool host** | Sandboxing via OS primitives—**Docker not assumed** |

### 1.4 Storage (optional SaaS only)

Postgres / object storage apply **only** if you host a remote bundle build registry—not for end-user inference.

---

## 2) Detailed Implementation Plan

### 2.1 Bundle manifest and directory contract

#### Deliverables

- **`manifest.json`** (at **stage-2 install root** only; single canonical path) includes:
  - **`bundle_schema_version`** (required): semver for this manifest shape; `agent-runtime` **refuses** unknown major.
  - **`vllm`**: version pin, `enable_prefix_caching: true`, allowlisted CLI/engine args.
  - **`model`**: id + **pinned revision** + on-disk layout or first-run download spec; **every** path must be **relative** to install root or tagged `user_data_relative`—no absolute paths from the spec server for end-user trees.
  - **`roles[]`**, **`apc`** / **`mtp`** policy ids.
  - **`memory`**: see §2.4 (required).
  - **`updates`** (optional): `{ "channel_url": "<https>" }` for support links only.
  - **`distribution`** (required): `profile_id` (**exact** CDN `profiles[].profile_id`, or **`"draft"`** only from Next pre-pack); `stage2_archive_format` **`"tar.zst"`**; `dropper_min_version` (semver); `channel_url` (HTTPS URL of `bundles.json`).
  - **`mtp`**: includes **`serialization_mode": "chat_messages"`** (v1 mandatory).

#### Path resolution (must be specified in code + doc)

- **Install root**: directory containing `manifest.json` (definitive).
- **`agent-runtime`**: resolves all `roles/*`, `prefixes/*`, `models/*` relative to install root; **rejects** `..` segments that escape root after `realpath`/normalize (prevents symlink escape if unpack uses symlinks).

#### Acceptance

- `agent-runtime validate <install_root>` exits **0** only if `FILES.sha256` passes, memory/device rules pass, and **`distribution.profile_id` ≠ `"draft"`**. **`run`** requires the same (draft manifests are authoring-only).
- **Ill-defined without this:** “relative to executable” vs “relative to cwd”—**install root = directory of `manifest.json`** wins.

---

### 2.2 Multi-Tenant Prefix (MTP) layout for vLLM APC

Same layered prefix model as before (global → shared context → role header → volatile tail). Deliverables:

- `docs/mtp-prefix-v1.md` — concatenation order, tokenizer stability, max layer sizes.
- Deterministic `buildPrompt(roleId, session)`.
- Tests: token-prefix goldens; optional GPU prefill latency regression.

Security: APC side-channel note for shared-host multi-tenant; default product is **single-user sovereign** machine.

#### 2.2.1 Tokenization path (v1)

APC matches on **token-id prefixes**. v1 **always** builds **OpenAI-style `messages[]`**, then runs them through the model tokenizer’s **`apply_chat_template`** with **`add_generation_prompt: true`** on the final assistant turn construction path (exact call site lives in `agent-runtime`; must be identical for the same logical prefix layers).

- **Whitespace and newlines** in `prefixes/*.txt` are **significant**; golden tests lock trailing newline presence/absence per file.
- **Unicode:** NFC at rest (Frozen table).

#### 2.2.2 Guided decoding (v1)

**Not supported.** No GBNF, no `guided_json`, no logits processor fields in `roles/*.yaml` for v1. Revisit in `bundle_schema_version` **2.x** only with a separate APC measurement spec.

---

### 2.3 Packaging: dropper (stage 1) + full portable bundle (stage 2) — no Docker

#### 2.3.1 Dropper binary (per platform)

**Hard budget:** release binary **< 5 MB** (compressed segment / linked deps included—define measurement: on-disk size after strip for CI gate).

**Responsibilities:**

1. **Probe**: OS version, arch (arm64 vs x86_64), Apple Silicon vs Intel (macOS), Metal API availability / GPU family (macOS), NVIDIA driver + CUDA capability (Windows/Linux if using CUDA bundles), minimum RAM/VRAM, free disk for declared install size.
2. **Resolve**: fetch **signed** bundle index over HTTPS; select **exactly one** stage-2 profile (e.g. `macos-metal`, `macos-fallback`, `windows-cuda`, `windows-cpu`).
3. **Download**: chunked stream, **resume**, **SHA256** (and optional **sigstore** / detached sig) verification before unpack.
4. **Install**: unpack to canonical user-writable location; atomic rename; record `installed_profile` + version for support.
5. **Handoff**: `exec` / `CreateProcess` **`agent-runtime`** from stage-2 install root with `argv[0]` set predictably; working directory = install root (or pass `--install-root`—pick **one** and test).

**Security:** TLS uses **system CA store only** (Frozen table). Verify index **then** verify embedded per-profile **`stage2_detached_signature_b64`** **before** download starts (fail-fast on bad CDN row). **Downgrade protection:** let `V_old` = `bundle_schema_version` read from `install_parent/current/manifest.json` if present, else null. Let `V_new` = selected profile’s **`bundle_schema_version`** from index. If `V_old` not null and `semver(V_new) < semver(V_old)` and **`--allow-downgrade` absent** → **`install` exits 10** (no network). If `major(V_old) > dropper_max_supported_bundle_major` → **`install` exits 10**. If **`--allow-downgrade`** passed → skip semver `<` check only.

#### 2.3.1b Install atomicity, locking, and partial failure (undefined → required)

| Concern | Required behavior |
|---------|-------------------|
| **Concurrent runs** | If `install_parent/install.lock` exists and owning PID is alive → **exit 6** (Frozen table). If stale (PID dead), dropper deletes lock and proceeds. |
| **Atomic swap** | Download to `*.partial` then `rename` into `stage2-<version>/`; **Unix**: `rename` over directory only if empty target removed first—use versioned dir + symlink `current` **or** rename temp root. **Windows**: file locking may block rename of running `agent-runtime`—support **side-by-side version dirs** + `current` junction, or instruct user to exit before update (must be explicit). |
| **Resume** | Partial files named `archive.part`; resume only if **length matches** partial state stored in sidecar JSON; on hash mismatch after complete download, **delete** partial and retry (bounded retries). |
| **Disk full mid-unpack** | Catch failure; delete incomplete staging dir; surface “need N GB” using `stage2_unpacked_min_bytes` from index. |
| **Quarantine (macOS)** | Downloaded binaries may carry `com.apple.quarantine`; document **one** flow: signed+notarized dropper + signed stage-2 unpack path, or `xattr` doc for dev only—not mixed messages. |

#### 2.3.1c Probe matrix (must be table-driven in code + tests)

**Ill-defined** if probes are only prose. Ship a **`probe_matrix.json`** (or embedded table in dropper tests) listing: `(os, arch, metal?, cuda_driver?, free_disk?) → expected profile_id` where the expected id is the **winner after §A.3 selection algorithm** (not “any row that matches predicates”). Minimum rows:

- macOS arm64, Metal yes, OS ≥ min → `macos-metal`
- macOS arm64, Metal no or OS below min → `macos-fallback`
- Windows x86_64, NVIDIA driver ≥ floor → `windows-cuda`
- Windows x86_64, no NVIDIA → `windows-cpu` (**v1 index ships `windows-cpu` with higher `selection_priority` than `windows-cuda`** so CUDA wins when driver probe passes; both may appear in index)

**Rosetta:** if you ship **arm64-only** stage-2, dropper on **x86_64 Mac** must **fail fast** with “unsupported arch”—do not download arm64 bundle silently.

#### 2.3.2 Stage 2 — `agent-runtime` + bundle (unchanged semantics)

- Locates **`manifest.json` at install root** (§2.1); refuses to run if cwd-only discovery would pick wrong tree.
- Verifies **`FILES.sha256`** (required): recomputes every listed file; then verifies weights if `model.weights_relative_path` points at on-disk files (or runs first-run download per manifest before starting vLLM).
- Starts **one** vLLM build **matching** `manifest.distribution.profile_id` and the on-disk wheel/native layout for that profile.
- **Loopback only:** vLLM child binds **`127.0.0.1:8000`** (internal). `agent-runtime` HTTP router binds **`127.0.0.1:8765`**; metrics **`127.0.0.1:8766`**. No `0.0.0.0` binds in v1. If any bind fails → **exit 9**.

#### Explicit non-goals

- **No** `Dockerfile` in the user-facing quickstart.
- **No** requirement to install **system** Python/pip/pyenv—stage 2 includes **vendored Python** when needed.

#### Build / registry

- `build_artifacts`: **dropper** artifacts (per OS, <5 MB) **and** **stage-2** zip/tar per profile **and** signed `bundles.json` (+ detached signatures for large blobs).

#### Acceptance

- CI: **size gate** on dropper (`< 5 * 1024 * 1024` bytes or product stricter).
- CI: magic-byte gate on **both** dropper and `agent-runtime`.
- Integration test: **mock** bundle index → dropper selects `macos-metal` vs `macos-fallback` based on injected probe results (table-driven).
- Docs: “Download 4 MB installer → run → it pulls the right big bundle”; alternate path “copy pre-downloaded stage-2 tree” for offline.

---

### 2.4 Smart memory management system (required)

This subsystem is **first-class** in `manifest.json` and enforced by `agent-runtime` **before** requests hit vLLM.

#### 2.4.1 Goals

- **Predictable footprint**: user knows worst-case VRAM and RAM from manifest + machine profile.
- **No silent OOM**: prefer **queue + backpressure** over crash.
- **APC-friendly**: preserve hot prefix blocks for **high-priority roles** under pressure.
- **Large-bundle friendly**: weights may be **60 GB+**; memory policy must cover **disk cache**, **mmap** (where supported), and **streaming download** without filling RAM.

#### 2.4.2 Manifest schema (`memory` block) — required fields (zod 1:1)

Implement **exactly** these keys (no additional keys in v1 `memory` object—reject unknown keys at validate):

| Field | Purpose |
|-------|---------|
| `gpu_memory_utilization_cap` | Upper bound passed to vLLM; leave headroom for KV + APC blocks |
| `max_num_seqs` / `max_concurrent_requests` | Hard cap on parallel generations |
| `cpu_offload_policy` | `none` \| `weights` \| `kv` (only if stack supports; document vLLM pin) |
| `prefix_cache_budget_tokens` or `kv_cache_soft_limit_fraction` | Soft limit to trigger eviction / shedding before OOM |
| `apc_priority_roles` | Ordered list: under memory pressure, prefer retaining prefixes for these `role_id`s |
| `disk_spill_dir` | Optional path for temporary decode buffers / downloaded shards (must default under bundle dir) |
| `download_chunk_mb` | Bounded in-memory buffering for first-run model fetch |
| `idle_release_policy` | After N minutes idle: optional unload of **non-weight** caches (not full model unload unless explicit user mode) |
| `host_ram_min_bytes` | **Dropper + runtime**: refuse start if physical RAM below floor (OOM avoidance before GPU) |
| `min_vram_bytes` | Required when `device_class` is `gpu` or `metal`; **must be 0** when `device_class` is `cpu` |

**Validation rules (zod):** If `device_class === "cpu"` → forbid non-zero `gpu_memory_utilization_cap`, `min_vram_bytes`, and `requires_cuda`-style fields; `cpu_offload_policy` must be `"none"`. If `device_class` is `gpu` or `metal` → `gpu_memory_utilization_cap` required in `(0,1]`; `min_vram_bytes` required **> 0**.

**v1 closed key set for `memory` (reject any other key):** `device_class`, `host_ram_min_bytes`, `min_vram_bytes`, `gpu_memory_utilization_cap`, `max_concurrent_requests`, `cpu_offload_policy`, `prefix_cache_budget_tokens`, `download_chunk_mb`, `apc_priority_roles`, `idle_release_policy`, `disk_spill_dir`. Omit unused keys in shipped manifests or set **`disk_spill_dir`** to **`"logs/spill"`** (relative string).

#### 2.4.3 Runtime behaviors (v1 — implement exactly this)

1. **Admission control**: When in-flight requests ≥ `memory.max_concurrent_requests`, new HTTP `POST /v1/invoke` returns **`429`** JSON `{ "error": { "code": "CAPACITY", "message": "…", "requestId" } }`; CLI `invoke` prints same to stderr and exits **11**.
2. **Preflight:** Before spawning vLLM, read **`memory.host_ram_min_bytes`** and **`memory.min_vram_bytes`** (add this required field next to `device_class`—see §2.4.2 table); if host RAM or reported GPU VRAM below floor → **exit 8** with one stderr line listing measured vs required.
3. **Token budgeting:** Enforce per-role `roles/*.yaml` `sampling.max_prompt_tokens` / `max_total_tokens` in router **before** HTTP to vLLM; reject with **`413`** / exit **12** if exceeded.
4. **Metrics:** Expose **`GET http://127.0.0.1:8766/metrics`** (JSON) with `{ "queue_depth", "in_flight", "vllm_restarts" }` only—no Prometheus in v1.
5. **Degradation:** v1 implements **(a) only**: when under sustained `429`, operators lower `max_concurrent_requests` in manifest and reinstall—no automatic APC disable in v1.

#### 2.4.4 Tests

- **Unit**: manifest `memory` validation; illegal combinations rejected at `validate` time.
- **Integration** (GPU): synthetic load generator proves queue engages before worker crash; optional metric that prefill latency improves with MTP warm prefixes.

#### Acceptance

- No shipping build without a populated `memory` block and passing validator tests.
- User-facing doc lists **minimum** and **recommended** VRAM for the pinned model + role set.

---

### 2.5 Harden API contract (spec server)

- Zod at route boundary; `ApiErrorBody` with `requestId` (shape: `{ error: { code, message, details?, requestId } }`).
- **Max request body:** **512 KiB** hard cap on `POST /api/bundle-spec` (return **413** if larger).
- **Wall clock:** handler must complete within **10s** CPU work; abort with **504** if exceeded (prevents hung RSC).

---

### 2.6 Cross-cutting “will not work” checklist (release gate)

Use as CI or human gate before calling a milestone done:

| Item | Failure if omitted |
|------|---------------------|
| `bundles.json` matches **Frozen** canonical signing + Ed25519 | Supply-chain or bricking on CDN typo |
| Dropper bootstrap URL priority (§1.0.2) | User cannot install offline without docs |
| `stage2_archive_sha256` + length verify before unpack | Malware / corrupted half-install |
| Install lock + atomic unpack | Corrupted tree or race |
| `distribution.profile_id` matches installed tree / binaries | Runtime SIGILL or wrong GPU path |
| `serialization_mode` is `chat_messages` only | APC never hits despite “same” English prompt |
| `memory.device_class` conditional validation | CPU bundle with GPU-only fields crashes obscurely |
| Loopback bind default secure | Accidental LAN exposure |
| Windows: MSVC runtime present for wheel ABI | “DLL load failed” at first vLL import—document **redist** bundled in stage 2 or static link choice |
| macOS: minimum OS for Metal build vs fallback | Wrong binary on older macOS |
| **WSL** | **Unsupported v1** (README one-liner) |

---

### 2.7 Observability, uninstall, and updates (minimum viable)

- **Logging**: structured logs under install root `logs/` with rotation cap (manifest `logging.max_mb`); default **no** remote telemetry.
- **Uninstall**: ship `agent-runtime uninstall` that removes install root **version dir** and `current` pointer; **never** delete arbitrary parent paths—validate root contains `manifest.json` before delete.
- **Updates:** `agent-setup install` when `current` already exists → **full replace** of target `versions/<semver>/` after successful download (same atomic rules). **No delta/binary patches in v1.**

---

### 2.8 Typed YAML + tests

- Library-backed YAML; round-trip + snapshots for bundle outputs.

---

### 2.9 Integration tests (revised)

| Test | Purpose |
|------|---------|
| Dropper size gate | `< 5 MB` per OS release binary |
| Native binary gate | Magic bytes on dropper + `agent-runtime`; reject stubs |
| Bundle index + selection | Probe fixtures → correct profile URL chosen |
| Bundle validator | manifest + `memory` + role refs |
| MTP prefix golden | Stable shared prefixes |
| GPU smoke (optional CI) | If runner has GPU: two `POST /v1/invoke` same `role_id` → second request **prefill wall time ≤ first** by ≥25% OR log vLLM cache stat if exposed in pinned vLLM |

---

## 3) HTTP API Surface (spec server)

- `POST /api/bundle-spec` (or evolved `agent-spec`) emits portable bundle contract including `memory` defaults suggestion for common GPUs (optional helper, not blocking).

---

## 4) Milestone Plan (Phased)

| Phase | Scope | Exit criteria |
|-------|--------|----------------|
| **1** | `BundleSpec` + `memory` + `updates`/channel fields in schema | Types + validator |
| **2** | Emit manifest + roles + MTP docs | Golden tests |
| **3** | API zod + errors | 400 envelope |
| **4** | **Dropper** per OS: probe + signed index + download verify + handoff | Size `< 5 MB`; selection tests |
| **5** | Stage 2: `agent-runtime` + vLLM (Metal / Windows / … profiles) + APC | CI per profile; copy-run doc |
| **6** | Memory governor + manifest-driven caps | Load test on stage 2 |
| **7** | Release: signed droppers + signed `bundles.json` + stage-2 archives | End-to-end mock CDN test |

---

## 5) Definition of Done (Strict)

1. **Two-stage UX**: Tiny **dropper** (`< 5 MB`) probes and pulls the correct **stage-2** bundle (macOS **Metal** vLLM when supported; Windows/Linux profiles as defined); optional offline “pre-seeded” stage-2 copy remains portable.
2. **Portable (stage 2)**: Materialized install tree is copyable; `agent-runtime` is native; no Docker.
3. **One model load**, MTP roles, **vLLM APC enabled**; no weight reload on role switch.
4. **Smart memory**: `manifest.json` `memory` policy enforced; queue/backpressure; documented VRAM floors; bounded download buffering for huge weights.
5. No training/supernode in product contract.
6. Spec server: strict validation + typed errors.
7. Contract tests for YAML/JSON bundle outputs.
8. CI: dropper size gate + native gates for dropper and `agent-runtime`.

---

## 6) PR Breakdown (Suggested)

| PR | Content |
|----|---------|
| **A** | `BundleSpec` + `memory` + channel/update fields |
| **B** | Manifest emission + memory defaults templates |
| **C** | API hardening |
| **D** | `docs/mtp-prefix-v1.md` + prefix builder tests |
| **E** | **Dropper** (Win/Mac/Linux): probe, `bundles.json`, download, <5 MB gate |
| **F** | Stage 2 `agent-runtime` + vLLM profiles (Metal macOS, Windows, …) |
| **G** | Memory governor + tests |
| **H** | Release pipeline: signed index + droppers + stage-2 archives |

---

## 7) Security and Operations

- **Dropper**: TLS, signed bundle index, hash/signature verify on every stage-2 byte; mitigate CDN swap; document upgrade policy.
- **HTTP(S) proxy:** honor `HTTPS_PROXY` / `NO_PROXY` for `agent-setup` fetch only.
- Model hash verify on first run; **resume** partial downloads.
- Tool execution: least privilege; **no Docker required**—use OS sandbox primitives.
- APC timing: documented for multi-user edge case; sovereign default is single-user.
- Secrets: env + OS keychain hooks in binary, not plaintext in manifest.
- **Air-gap**: document **`--bundle-path`** (or env) to install from pre-copied archive **without** index fetch, still requiring **local** hash verify against **sidecar** `.sha256` shipped with thumb drive.

---

## 8) Release signing (binaries) — v1

- **Windows:** Authenticode-sign **`agent-setup.exe`** and **`agent-runtime.exe`**; ship **`vc_redist.x64.exe`** inside stage-2 `support/` and run silent install from dropper on first install if MSVC runtime probe fails (probe: attempt `LoadLibrary` on `vcruntime140.dll` in `System32`—if missing, run redist **once**).
- **macOS:** Sign **both** binaries with **Developer ID**; **notarize** both; staple tickets. Gatekeeper is product requirement for default download path.
- **Linux:** Sign with **GPG detached** optional; **not required** for v1 CI—`FILES.sha256` + HTTPS from vendor CDN is minimum. Enterprise mirrors use `--bundle-path`.

---

## Appendix A — Engineer playbook (implementation-ready)

This section ties prior prose to **concrete artifacts** so an engineer can start without inventing layout or CLI.

### A.1 Canonical install paths (stage 2 parent)

Use **one** product id slug (e.g. `nexus-agent`). Parent = `install_parent`; active install = `install_parent/current/` (symlink/junction) → `install_parent/versions/<semver>/`.

| OS | `install_parent` default |
|----|---------------------------|
| **Windows** | `%LOCALAPPDATA%\nexus-agent` (expand env; create if missing) |
| **macOS** | `$HOME/Library/Application Support/nexus-agent` |
| **Linux** | `$XDG_DATA_HOME/nexus-agent` if set, else `$HOME/.local/share/nexus-agent` |

**Dropper staging** (same parent): `install_parent/staging/<uuid>/` for download + unpack; on success: move tree to `install_parent/versions/<version>/`, atomically update `current` (see §2.3.1b for Windows locking).

### A.2 Stage-2 directory tree (normative)

After unpack, **`manifest.json` MUST exist at**:

`install_root/manifest.json` where `install_root = install_parent/versions/<semver>/` (or `.../current` resolved to real path).

```
<install_root>/
  manifest.json
  FILES.sha256              # required (v1): line format "<64-hex><two spaces><relative/path>"
  agent-runtime             # or agent-runtime.exe on Windows
  python/                   # vendored CPython layout (platform-specific; document in build doc)
    bin/python3
    lib/...
  lib/                      # optional: extra native .dll/.dylib/.so for wheels
  roles/
    <role_id>.yaml
  prefixes/
    <layer_id>.txt          # UTF-8, NFC normalized on write
  tools/
    policies.yaml           # tool allowlist / argv templates
  models/
    README.txt              # optional pointer if weights downloaded elsewhere
    ...                     # weight shards or symlinks to cache dir (document one policy)
  logs/                     # created at runtime; rotation per manifest
```

**Executable names:** `agent-runtime` (Unix), `agent-runtime.exe` (Windows). Dropper handoff: **spawn** `install_root/agent-runtime[.exe]` with `cwd=install_root` and env `NEXUS_AGENT_INSTALL_ROOT=<absolute install_root>` (single env contract—implementers choose prefix if product rebrands).

### A.3 `bundles.json` — minimal valid example

```json
{
  "index_schema_version": 1,
  "channel": "nexus-agent",
  "released_at": "2026-04-24T12:00:00Z",
  "signing_key_id": "ed25519-2026-04",
  "index_signature_algorithm": "ed25519",
  "index_signature_b64": "<base64-signature-over-canonical-json>",
  "profiles": [
    {
      "profile_id": "macos-metal",
      "bundle_schema_version": "1.0.0",
      "selection_priority": 10,
      "cpu_arch": "arm64",
      "min_os_version": "14.0",
      "requires_metal": true,
      "stage2_archive_url": "https://cdn.example.com/stage2/macos-metal-1.4.0.tar.zst",
      "stage2_archive_sha256": "<64-hex>",
      "stage2_archive_bytes": 12345678901,
      "stage2_unpacked_min_bytes": 20000000000,
      "stage2_detached_signature_b64": "<base64-ed25519-sig>"
    },
    {
      "profile_id": "macos-fallback",
      "bundle_schema_version": "1.0.0",
      "selection_priority": 100,
      "cpu_arch": "arm64",
      "min_os_version": "13.0",
      "requires_metal": false,
      "stage2_archive_url": "https://cdn.example.com/stage2/macos-fallback-1.4.0.tar.zst",
      "stage2_archive_sha256": "<64-hex>",
      "stage2_archive_bytes": 9876543210,
      "stage2_unpacked_min_bytes": 15000000000,
      "stage2_detached_signature_b64": "<base64-ed25519-sig>"
    }
  ]
}
```

**Profile selection algorithm (deterministic):**

1. **Filter** `profiles[]` to rows where: `cpu_arch` matches host; OS version in `[min_os_version, max_os_version]`; free disk ≥ `stage2_unpacked_min_bytes`; `requires_metal` / `requires_no_metal` / `requires_cuda` satisfied.
2. If **empty** → exit `3` with stderr table of each row and first failed predicate.
3. **Sort** remaining by ascending `selection_priority`, then ascending `profile_id`.
4. **Pick** first row in sorted list (winner).

**Example:** `macos-metal` has `selection_priority: 10`, `requires_metal: true`. `macos-fallback` has `selection_priority: 100`, `requires_metal: false`. On a Metal Mac both pass filter → metal wins (10 < 100).

**`cpu_arch` match:** host arch must equal row’s `cpu_arch`, except document **`universal`** if you ever ship fat binaries (then row matches both—rare).

**`min_os_version` / `max_os_version`:** implement **platform-specific** parsers in shared library: **macOS** = Darwin major.minor from `uname` / `Gestalt` / `sysctl`; **Windows** = build number + edition if needed; **Linux** = kernel `uname -r` **or** distro version file—**document which** your dropper uses and test. Do not assume semver strings compare with generic `semver` lib unless normalized first.

### A.4 `manifest.json` — minimal shape (stage 2)

```json
{
  "bundle_schema_version": "1.0.0",
  "distribution": {
    "profile_id": "macos-metal",
    "stage2_archive_format": "tar.zst",
    "dropper_min_version": "1.0.0",
    "channel_url": "https://cdn.example.com/nexus-agent/bundles.json"
  },
  "vllm": {
    "package_version": "0.x.y",
    "enable_prefix_caching": true,
    "launch": ["serve", "MODEL_REF", "--enable-prefix-caching", "--host", "127.0.0.1", "--port", "8000"]
  },
  "model": {
    "id": "org/model",
    "revision": "abc123def",
    "weights_relative_path": "models/weights",
    "tokenizer_relative_path": "models/tokenizer"
  },
  "memory": {
    "device_class": "metal",
    "host_ram_min_bytes": 8589934592,
    "min_vram_bytes": 17179869184,
    "gpu_memory_utilization_cap": 0.85,
    "max_concurrent_requests": 4,
    "download_chunk_mb": 32,
    "apc_priority_roles": ["orchestrator", "executor"]
  },
  "mtp": { "policy_id": "mtp-v1", "serialization_mode": "chat_messages" },
  "roles": [
    { "id": "orchestrator", "definition_relative_path": "roles/orchestrator.yaml", "prefix_layer_ids": ["global", "orchestrator_header"] }
  ],
  "logging": { "max_mb": 256 }
}
```

**Note:** `vllm.launch` is an **array of strings**; first element is subcommand or binary name as **your** wrapper expects—normalize in `agent-runtime` so you do not shell-inject.

### A.5 `roles/<id>.yaml` — minimal shape

```yaml
role_id: orchestrator
sampling:
  temperature: 0.0
  max_prompt_tokens: 8192
  max_total_tokens: 12288
tools_allowlist:
  - id: read_file
    argv_template: ["cat", "{path}"]
mtp:
  suffix_template_relative_path: prefixes/orchestrator_suffix.txt
```

### A.6 Dropper CLI (normative contract)

```
agent-setup [global-options] <command>

Global options:
  --index-url <https URL>     Override bundle index (highest priority)
  --install-parent <path>     Override default install_parent (§A.1)
  --allow-downgrade           Skip semver downgrade block (§2.3.1)
  --verbose                   Log probe + selection to stderr

Commands:
  install                     Probe → fetch index → verify index sig + row sig → download stage2 → verify sha256+len → verify stage2 sig → unpack → update current → exec agent-runtime
  install --bundle-path <path> --expected-sha256 <64-hex> --expected-bytes <int> --profile-id <id> --bundle-schema-version <semver> --stage2-signature-b64 <b64>
                              Offline v1: no network; file must match sha256+bytes; Ed25519 verify message uses **`profile_id` + sha256 + bytes** from CLI args (must match post-unpack `manifest.json`); downgrade rule uses **`--bundle-schema-version`** as `V_new` vs disk `V_old`
  doctor                      Print probe results + selected `profile_id` + disk paths (dry-run; fetches index unless `--offline`)

Exit codes: **0** success | **1** usage | **2** network/TLS | **3** no matching profile | **4** verify/hash/sig fail | **5** disk full | **6** install locked (live PID) | **7** Windows in-use (`agent-runtime` running—stop first) | **10** downgrade blocked | **11** capacity (reserved—CLI wrapper) | **12** token limit (reserved)
```

### A.7 `agent-runtime` CLI (normative contract)

```
agent-runtime [--install-root <path>] <command>

Install root resolution (first match wins):
1. `--install-root` if set
2. else `NEXUS_AGENT_INSTALL_ROOT` env
3. else if **`./manifest.json`** exists in cwd → **cwd**
4. else resolve **`current`** junction: read `install_parent/current/manifest.json` using same `install_parent` defaults as §A.1
5. else **exit 1** (“no manifest”)

Commands:
  run [--foreground]        Start vLLM child + router; foreground keeps vLLM logs attached (optional)
  validate [path]             Default path = install root; validate manifest + FILES.sha256 if present + memory schema
  stop                        SIGTERM vLLM child + graceful shutdown (timeout 30s then SIGKILL)
  uninstall [--i-understand] Requires flag; removes install_parent/versions/<this> and rewrites current if it pointed here
  version                     Print manifest bundle_schema_version + distribution.profile_id + binary git sha
```

**HTTP (local):** **`127.0.0.1:8765`** — `POST /v1/invoke` body **JSON** `{ "role_id": string, "session_id": string, "user_turn": string, "tool_results"?: { "role": string, "text": string }[] }` (matches §A.13). **`127.0.0.1:8766`** — `GET /metrics` JSON per §2.4.3.

### A.8 Stage-2 archive contents rule

The archive root **must** be the **contents** of `install_root` (so unpacking into empty `versions/x/` yields `manifest.json` at that folder’s top level—not nested `macos-metal/manifest.json` unless dropper strips one segment). **CI:** assert `test -f "$unpack_dir/manifest.json"` after unpack fixture.

### A.9 `FILES.sha256` format (if shipped)

- Text file UTF-8; one line per file: `<64 lowercase hex><two spaces><relative path from install root>`.
- No leading `./`; paths use `/` on all platforms inside file (normalize on Windows when verifying).
- `agent-runtime validate` recomputes hashes for listed files and fails on first mismatch.

### A.10 Spec server (this repo) — concrete file checklist

| Step | File / action |
|------|----------------|
| Input zod | Add `lib/server/bundle-spec/input-schema.ts` with `userRequest`, `llmResponse`, max lengths |
| Route | `app/api/bundle-spec/route.ts`: `safeParse` body; max body **512 KiB**; return `ApiErrorBody` |
| Errors | `lib/server/http/errors.ts`: `toErrorResponse(err, requestId)` |
| Emit | `generateBundleSpec` → `manifest.json` object + YAML per role; include `distribution` placeholder `profile_id: "unresolved-at-build-time"` **or** omit and document that spec-server only drafts—**production manifest** is rewritten by stage-2 packer with real `profile_id` |

**Clarification:** the Next app may emit a **draft** manifest for authoring; the **release pipeline** that builds stage-2 archives **must inject** final `distribution.profile_id` and hashes. Document both flows so engineers do not merge draft into CDN by mistake.

### A.11 Dropper size gate (CI — copy-paste)

```bash
test "$(wc -c < dist/agent-setup)" -lt 5242880
```

Run on **stripped** release artifact per OS.

### A.12 vLLM child process contract

- `agent-runtime run` spawns: `python/lib/python3.x/site-packages/...` is **not** invoked by users; runtime runs `python/bin/python3 -m vllm.entrypoints.openai.api_server` **or** your pinned equivalent with argv built **only** from `manifest.vllm.launch` allowlist (no shell `-c`).
- Child stdout/stderr: tee to `logs/vllm.log` with rotation.
- Parent waits on child PID; on unexpected exit, exit code propagates to `agent-runtime` and optionally restarts with backoff (document max restarts—default 3).

### A.13 MTP `buildPrompt` I/O contract (router)

**Input:** `{ role_id: string, session_id: string, user_turn: string, tool_results?: { role: string, text: string }[] }`.

**Output:** OpenAI-style `messages[]` **or** single string—**must match** `manifest.mtp.serialization_mode` (`chat_messages` \| `raw_string`). Tokenizer call uses model’s `tokenizer_relative_path`; chat template uses `tokenizer_config.json` from same tree.

**Layer assembly:** read files for `prefixes/<layer_id>.txt` in order `global` → role `prefix_layer_ids` from `roles/<id>.yaml` → append `user_turn` in a delimiter block `<<<USER>>>\n...\n<<<END_USER>>>` (exact delimiters in `docs/mtp-prefix-v1.md`—must be stable bytes).
