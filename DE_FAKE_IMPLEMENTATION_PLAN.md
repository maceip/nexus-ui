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

**macOS branch (required behavior in plan):** if probes determine **Metal-capable** hardware + **supported macOS version** + **Metal build of vLLM** is available for this product pin, download **`bundle-macos-metal-…`** (name illustrative). Else download the documented **`bundle-macos-fallback-…`** (e.g. CPU-only or older OS).

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
| `signing_key_id` | recommended | String id of pubkey used to verify `index_signature_*` (supports rotation) |
| `index_signature_algorithm` | recommended | e.g. `ed25519` |
| `index_signature_b64` | recommended | Base64 signature over **canonical UTF-8 bytes** of the JSON object **with these three fields omitted** (`index_signature_algorithm`, `index_signature_b64`, `signing_key_id`) and with **`profiles` sorted by `profile_id`** (stable canonicalization—implement exact algorithm in ADR and test vectors) |
| `profiles[]` | yes | One object per selectable stage-2 artifact |

Each **`profiles[]`** entry:

| Field | Required | Meaning |
|-------|----------|---------|
| `profile_id` | yes | Stable id: `macos-metal`, `macos-fallback`, `windows-cuda`, `windows-cpu`, `linux-cuda`, `linux-cpu`, … |
| `selection_priority` | yes | Integer **≥ 0**; **lower value = higher priority**. After filtering to rows whose predicates pass, pick the **passing row with minimum `selection_priority`**; tie-breaker lexicographic `profile_id`. **Without this field, multiple rows can match one machine** (e.g. fallback and metal both “pass” if `requires_metal` is only one-way)—do not ship an index without priorities |
| `stage2_archive_url` | yes | HTTPS URL to **one** file (`.zip` / `.tar.zst` / `.tar.gz`—pick **one** format per product and document) |
| `stage2_archive_sha256` | yes | Hash of the **entire** archive file on disk after download (before unpack) |
| `stage2_archive_bytes` | yes | Exact byte length; dropper rejects download if `Content-Length` (if present) mismatches or final size ≠ this |
| `stage2_unpacked_min_bytes` | yes | **Minimum free disk** required before download starts (compressed + peak unpack temp; be conservative) |
| `min_os_version` / `max_os_version` | yes / optional | Inclusive semver or platform-specific tuples (e.g. mac `14.0+`); **probe must implement same comparator** as CI fixtures |
| `cpu_arch` | yes | `arm64` \| `x86_64` \| `universal` (if ever used—define semantics) |
| `requires_metal` | optional | If **true**, host must pass Metal probe. If **false**, no constraint (host may or may not have Metal)—**therefore** fallback rows **must** use higher `selection_priority` than `macos-metal` so Metal machines still pick metal first |
| `requires_no_metal` | optional | If **true**, host must **fail** Metal probe (CPU-only / software-render path)—use for explicit CPU bundles on macOS when you must exclude Metal-capable hosts |
| `requires_cuda` | optional | If true, NVIDIA driver + capability probe passes |
| `min_dropper_version` | optional | Reject if dropper too old to verify this profile’s format |
| `detached_signature_url` | recommended | Signature over `stage2_archive_sha256` + `profile_id` + `stage2_archive_bytes` (define exact signed payload in ADR) |
| `release_notes_url` | optional | Human-readable |

**Index integrity:** ship **detached signature** over canonical JSON bytes of `bundles.json` **or** sign a **manifest list hash**; dropper embeds **ed25519** (or min RSA) pubkey; **rotation**: support **pubkey id** in index header + multiple embedded keys in dropper until rotation completes.

**Ill-defined unless fixed:** “signed `bundles.json`” without **which bytes are signed** and **which key** is a release blocker—lock in ADR before first ship.

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
  - `vllm`: version pin, `enable_prefix_caching: true`, allowlisted CLI/engine args.
  - **`distribution.profile_id`** (required): **exact copy** of the `profiles[].profile_id` from `bundles.json` that was installed (e.g. `macos-metal`, `windows-cuda`). Validator compares this string only—**do not** use a separate short `build_profile` enum that can drift from the index.
  - `model`: id + **pinned revision** + on-disk layout or first-run download spec; **every** path in manifest must be **relative** to install root or explicitly tagged `user_data_relative`—no absolute paths baked at spec-server emit time for end-user machines.
  - `roles[]`, `apc` / `mtp` policy id.
  - **`memory`**: see §2.4 (required block—no silent defaults).
  - **`updates`** (optional but recommended): base URL or channel id for **dropper** to check for stage-2 updates (same trust model as initial download).
  - **`distribution`** (required object): at minimum `profile_id` (see above), `stage2_archive_format` (`zip` \| `tar.zst` \| `tar.gz`), `dropper_min_version` (semver of oldest dropper allowed to update this tree), optional `channel_url` echo for support.

#### Path resolution (must be specified in code + doc)

- **Install root**: directory containing `manifest.json` (definitive).
- **`agent-runtime`**: resolves all `roles/*`, `prefixes/*`, `models/*` relative to install root; **rejects** `..` segments that escape root after `realpath`/normalize (prevents symlink escape if unpack uses symlinks).

#### Acceptance

- `agent-runtime validate <install_root>` exits 0 only if hashes, cross-refs, memory policy, and **`distribution.profile_id` vs on-disk layout** checks pass (stage 2 self-consistency).
- **Ill-defined without this:** “relative to executable” vs “relative to cwd”—**install root = directory of `manifest.json`** wins.

---

### 2.2 Multi-Tenant Prefix (MTP) layout for vLLM APC

Same layered prefix model as before (global → shared context → role header → volatile tail). Deliverables:

- `docs/mtp-prefix-v1.md` — concatenation order, tokenizer stability, max layer sizes.
- Deterministic `buildPrompt(roleId, session)`.
- Tests: token-prefix goldens; optional GPU prefill latency regression.

Security: APC side-channel note for shared-host multi-tenant; default product is **single-user sovereign** machine.

#### 2.2.1 Tokenization path (otherwise APC “will not work” as designed)

APC matches on **token-id prefixes**, not raw UTF-8. The plan is **ill-defined** unless you pick **one** canonical serialization for every request:

- **Either** always use the model’s **chat template** (`apply_chat_template`) with a fixed `add_generation_prompt` policy **or** always use a single raw-string format—**never mix** per role without documenting separate APC domains.
- **Whitespace and newlines** are part of the prefix: golden tests must include **final newline policy**.
- **BPE stability**: rare unicode normalization differences across OS—document NFC vs as-is for user paste.

#### 2.2.2 Guided decoding / grammar vs APC (vLLM behavior)

vLLM may **disable or skip prefix-cache reads** for certain features (e.g. when extra logits / constrained decoding modes conflict with cache hits—behavior is **version-specific**). If a role uses **GBNF / JSON schema** grammar:

- Document for that **pinned vLLM** whether APC hits are still expected for the **static prefix** portion.
- If not, MTP still saves **weight reload**; latency win moves to **decode** / structure only—**do not claim APC prefill wins** in docs without measuring that pin.

**Code smell to avoid:** passing `grammar_file` as a path string into a hypothetical `SamplingParams` field that does not exist in your pinned vLLM—**bind to real API** in ADR per version.

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

**Security:** TLS: default **system CA store**; if using **pinning**, document **corporate SSL inspection** breakage and IT override (`--index-url` / custom CA path). Index signature verified with **embedded** pubkey (§1.0.1). **Downgrade protection:** if installed `manifest.bundle_schema_version` > dropper-supported max, dropper must **not** overwrite with older CDN artifact—abort with error.

#### 2.3.1b Install atomicity, locking, and partial failure (undefined → required)

| Concern | Required behavior |
|---------|-------------------|
| **Concurrent runs** | Second dropper instance must detect **lock file** (`install.lock` with PID + timestamp) under staging parent; exit **or** wait with timeout (product choice—document). |
| **Atomic swap** | Download to `*.partial` then `rename` into `stage2-<version>/`; **Unix**: `rename` over directory only if empty target removed first—use versioned dir + symlink `current` **or** rename temp root. **Windows**: file locking may block rename of running `agent-runtime`—support **side-by-side version dirs** + `current` junction, or instruct user to exit before update (must be explicit). |
| **Resume** | Partial files named `archive.part`; resume only if **length matches** partial state stored in sidecar JSON; on hash mismatch after complete download, **delete** partial and retry (bounded retries). |
| **Disk full mid-unpack** | Catch failure; delete incomplete staging dir; surface “need N GB” using `stage2_unpacked_min_bytes` from index. |
| **Quarantine (macOS)** | Downloaded binaries may carry `com.apple.quarantine`; document **one** flow: signed+notarized dropper + signed stage-2 unpack path, or `xattr` doc for dev only—not mixed messages. |

#### 2.3.1c Probe matrix (must be table-driven in code + tests)

**Ill-defined** if probes are only prose. Ship a **`probe_matrix.json`** (or embedded table in dropper tests) listing: `(os, arch, metal?, cuda_driver?, free_disk?) → expected profile_id` where the expected id is the **winner after §A.3 selection algorithm** (not “any row that matches predicates”). Minimum rows:

- macOS arm64, Metal yes, OS ≥ min → `macos-metal`
- macOS arm64, Metal no or OS below min → `macos-fallback`
- Windows x86_64, NVIDIA driver ≥ floor → `windows-cuda`
- Windows x86_64, no NVIDIA → `windows-cpu` **or** hard fail (choose one per product—**index must not list both without disjoint predicates**)

**Rosetta:** if you ship **arm64-only** stage-2, dropper on **x86_64 Mac** must **fail fast** with “unsupported arch”—do not download arm64 bundle silently.

#### 2.3.2 Stage 2 — `agent-runtime` + bundle (unchanged semantics)

- Locates **`manifest.json` at install root** (§2.1); refuses to run if cwd-only discovery would pick wrong tree.
- Verifies **embedded** `MANIFEST.sha256` or per-file manifest in bundle if you ship file lists; ensures weights (ship or download per manifest).
- Starts **one** vLLM build **matching** `manifest.distribution.profile_id` and the on-disk wheel/native layout for that profile.
- **Local loopback only** (`127.0.0.1` bind + optional Unix socket)—document default port; **fail closed** if bind fails (no wildcard `0.0.0.0` in default secure profile).

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

#### 2.4.2 Manifest schema (`memory` block) — implementers must ship defaults

Illustrative fields (exact names in zod when implemented):

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

**Gap closed:** `memory.gpu_memory_utilization_cap` is **meaningless** on **CPU-only** profiles—validator must require **`device_class`** (`gpu` \| `cpu` \| `metal`) and conditional-field rules so invalid combos fail at `validate` time, not at vLLM launch.

#### 2.4.3 Runtime behaviors (must implement or explicitly defer with ADR)

1. **Admission control**: Router queues invocations when `max_concurrent_requests` saturated; returns structured error to local clients (HTTP 429 or CLI message).
2. **Preflight check**: On startup, estimate **minimum VRAM** from manifest + model card; if below threshold, **fail fast** with clear message (prefer failing to half-running and OOM-killing).
3. **Token budgeting**: Per-role `max_prompt_tokens` / `max_total_tokens` to cap pathological prompts that blow KV and evict useful APC entries.
4. **LRU awareness**: Document interaction with vLLM’s APC LRU behavior; optionally expose metrics (prefill ms, queue depth) on localhost admin port.
5. **Graceful degradation ladder** (product-defined order, implement one default):
   - (a) shrink concurrent slots  
   - (b) shorten retained tool transcripts in volatile tail only—not shared prefixes  
   - (c) drop lowest-priority role’s warm prefix **last**  
   - (d) optional: user-invoked “cold mode” that disables APC for debugging only  

#### 2.4.4 Tests

- **Unit**: manifest `memory` validation; illegal combinations rejected at `validate` time.
- **Integration** (GPU): synthetic load generator proves queue engages before worker crash; optional metric that prefill latency improves with MTP warm prefixes.

#### Acceptance

- No shipping build without a populated `memory` block and passing validator tests.
- User-facing doc lists **minimum** and **recommended** VRAM for the pinned model + role set.

---

### 2.5 Harden API contract (spec server)

- Zod at route boundary; `ApiErrorBody` with `requestId`.
- **Body size limit** for `POST` (e.g. max JSON bytes) to avoid accidental DoS—currently unbounded in many Next handlers.
- **Timeout** on `generateBundleSpec` if future steps add I/O—today pure CPU but document max wall time for RSC.

---

### 2.6 Cross-cutting “will not work” checklist (release gate)

Use as CI or human gate before calling a milestone done:

| Item | Failure if omitted |
|------|---------------------|
| `bundles.json` schema version + signed bytes spec | Supply-chain or bricking on CDN typo |
| Dropper bootstrap URL priority (§1.0.2) | User cannot install offline without docs |
| `stage2_archive_sha256` + length verify before unpack | Malware / corrupted half-install |
| Install lock + atomic unpack | Corrupted tree or race |
| `distribution.profile_id` matches installed tree / binaries | Runtime SIGILL or wrong GPU path |
| Single chat-template serialization for MTP (§2.2.1) | APC never hits despite “same” English prompt |
| `memory.device_class` conditional validation | CPU bundle with GPU-only fields crashes obscurely |
| Loopback bind default secure | Accidental LAN exposure |
| Windows: MSVC runtime present for wheel ABI | “DLL load failed” at first vLL import—document **redist** bundled in stage 2 or static link choice |
| macOS: minimum OS for Metal build vs fallback | Wrong binary on older macOS |
| **WSL** | **Out of scope** unless explicitly tested—state in README to avoid “works on Ubuntu” support tickets for WSL2 GPU passthrough |

---

### 2.7 Observability, uninstall, and updates (minimum viable)

- **Logging**: structured logs under install root `logs/` with rotation cap (manifest `logging.max_mb`); default **no** remote telemetry.
- **Uninstall**: ship `agent-runtime uninstall` that removes install root **version dir** and `current` pointer; **never** delete arbitrary parent paths—validate root contains `manifest.json` before delete.
- **Updates**: dropper `--reinstall` or `agent-runtime update` re-invokes dropper with same trust chain; **delta updates** out of scope unless ADR adds binary diff format.

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
| Optional GPU | APC warm-path or prefill timing (stage 2) |

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
- **HTTP(S) proxy**: honor `HTTPS_PROXY` / `NO_PROXY` for enterprise; document interaction with TLS pinning if enabled.
- Model hash verify on first run; **resume** partial downloads.
- Tool execution: least privilege; **no Docker required**—use OS sandbox primitives.
- APC timing: documented for multi-user edge case; sovereign default is single-user.
- Secrets: env + OS keychain hooks in binary, not plaintext in manifest.
- **Air-gap**: document **`--bundle-path`** (or env) to install from pre-copied archive **without** index fetch, still requiring **local** hash verify against **sidecar** `.sha256` shipped with thumb drive.

---

## 8) Open Engineering Decisions

1. **vLLM distribution** (per **stage-2 profile**): vendored Python + wheels inside each large bundle; **Metal** macOS build vs **CUDA/CPU** others—separate CI matrices per profile.
2. **Metal on macOS**: confirm upstream/build pipeline for a **pinned** vLLM (or supported fork) for Apple GPU; define exact `macos-metal` vs `macos-fallback` probe matrix (OS version, chip, driver).
3. **Apple / Windows signing**: sign **dropper** and **stage-2** layout; notarization for macOS dropper (stapling policy).
4. **Exact vLLM memory knobs** at pinned version (map `memory` manifest → engine args).
5. **Dropper implementation language** (Rust/Go/C++) vs size budget—must stay **< 5 MB** with HTTPS + verify deps.
6. **Offline**: dropper **`--bundle-path`** + optional `--expected-sha256`** (required if no signature infra)—close before “air-gap” milestone.
7. **WSL / devcontainers**: explicitly **unsupported** or **supported** with CI matrix—pick one; undefined = support debt.

Link ADRs after resolution (minimum: **signed index bytes**, **stage-2 archive format**, **Metal vs fallback probe**, **TLS pinning policy**).

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
  FILES.sha256              # optional: line format "hexhash  relative/path" (two spaces); used by validate
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
      "selection_priority": 10,
      "cpu_arch": "arm64",
      "min_os_version": "14.0",
      "requires_metal": true,
      "stage2_archive_url": "https://cdn.example.com/stage2/macos-metal-1.4.0.tar.zst",
      "stage2_archive_sha256": "<64-hex>",
      "stage2_archive_bytes": 12345678901,
      "stage2_unpacked_min_bytes": 20000000000,
      "detached_signature_url": "https://cdn.example.com/stage2/macos-metal-1.4.0.tar.zst.sig"
    },
    {
      "profile_id": "macos-fallback",
      "selection_priority": 100,
      "cpu_arch": "arm64",
      "min_os_version": "13.0",
      "requires_metal": false,
      "stage2_archive_url": "https://cdn.example.com/stage2/macos-fallback-1.4.0.tar.zst",
      "stage2_archive_sha256": "<64-hex>",
      "stage2_archive_bytes": 9876543210,
      "stage2_unpacked_min_bytes": 15000000000
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
    "gpu_memory_utilization_cap": 0.85,
    "max_concurrent_requests": 4,
    "download_chunk_mb": 32,
    "apc_priority_roles": ["orchestrator", "executor"]
  },
  "mtp": { "policy_id": "mtp-v1" },
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
  --verbose                   Log probe + selection to stderr

Commands:
  install                     Probe → fetch index → verify → download stage2 → unpack → update current → exec agent-runtime
  install --bundle-path <path> [--expected-sha256 <64-hex>]
                              Offline: skip index fetch; verify local archive size+hash then unpack
  doctor                      Print probe results + which profile would be selected + disk paths (no network)

Exit codes: 0 success | 1 usage | 2 network/TLS | 3 no matching profile | 4 verify/hash fail | 5 disk full | 6 locked | 10 downgrade blocked
```

### A.7 `agent-runtime` CLI (normative contract)

```
agent-runtime [--install-root <path>] <command>   # default: env NEXUS_AGENT_INSTALL_ROOT or cwd if manifest.json in cwd

Commands:
  run [--foreground]        Start vLLM child + router; foreground keeps vLLM logs attached (optional)
  validate [path]             Default path = install root; validate manifest + FILES.sha256 if present + memory schema
  stop                        SIGTERM vLLM child + graceful shutdown (timeout 30s then SIGKILL)
  uninstall [--i-understand] Requires flag; removes install_parent/versions/<this> and rewrites current if it pointed here
  version                     Print manifest bundle_schema_version + distribution.profile_id + binary git sha
```

**HTTP (local):** default `127.0.0.1:8765` (pick one port; document in README)—`POST /v1/invoke` JSON `{ "role_id", "messages" | "input" }`—exact JSON schema in OpenAPI fragment under `docs/` (add file in implementation PR).

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
