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

**Bundle index:** dropper fetches a **signed** `bundles.json` (or equivalent) listing `{ profile_id, url, sha256, min_os, signatures }` so selection logic is versioned server-side without redeploying the dropper for every hotfix (only index + CDN).

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

- **`manifest.json`** includes:
  - `vllm`: version pin, `enable_prefix_caching: true`, allowlisted CLI/engine args; optional `build_profile` (`metal` | `cuda` | `cpu`, …) echoing what the dropper installed.
  - `model`: id + **pinned revision** + on-disk layout or first-run download spec.
  - `roles[]`, `apc` / `mtp` policy id.
  - **`memory`**: see §2.4 (required block—no silent defaults).
  - **`updates`** (optional but recommended): base URL or channel id for **dropper** to check for stage-2 updates (same trust model as initial download).

#### Acceptance

- `agent-runtime validate ./bundle` exits 0 only if hashes, cross-refs, and memory policy validate.

---

### 2.2 Multi-Tenant Prefix (MTP) layout for vLLM APC

Same layered prefix model as before (global → shared context → role header → volatile tail). Deliverables:

- `docs/mtp-prefix-v1.md` — concatenation order, tokenizer stability, max layer sizes.
- Deterministic `buildPrompt(roleId, session)`.
- Tests: token-prefix goldens; optional GPU prefill latency regression.

Security: APC side-channel note for shared-host multi-tenant; default product is **single-user sovereign** machine.

---

### 2.3 Packaging: dropper (stage 1) + full portable bundle (stage 2) — no Docker

#### 2.3.1 Dropper binary (per platform)

**Hard budget:** release binary **< 5 MB** (compressed segment / linked deps included—define measurement: on-disk size after strip for CI gate).

**Responsibilities:**

1. **Probe**: OS version, arch (arm64 vs x86_64), Apple Silicon vs Intel (macOS), Metal API availability / GPU family (macOS), NVIDIA driver + CUDA capability (Windows/Linux if using CUDA bundles), minimum RAM/VRAM, free disk for declared install size.
2. **Resolve**: fetch **signed** bundle index over HTTPS; select **exactly one** stage-2 profile (e.g. `macos-metal`, `macos-fallback`, `windows-cuda`, `windows-cpu`).
3. **Download**: chunked stream, **resume**, **SHA256** (and optional **sigstore** / detached sig) verification before unpack.
4. **Install**: unpack to canonical user-writable location; atomic rename; record `installed_profile` + version for support.
5. **Handoff**: exec `agent-runtime` from stage 2 (or spawn installer MSI/exe on Windows if product uses that layout—still no Docker).

**Security:** TLS pinning or trust-on-first-use policy documented; index signature verified with **embedded** public key in dropper (small); reject downgrades if manifest requires minimum stage-2 version.

#### 2.3.2 Stage 2 — `agent-runtime` + bundle (unchanged semantics)

- Locates `manifest.json` per documented rule relative to install root.
- Verifies hashes; ensures weights (ship or download per manifest).
- Starts **one** vLLM build **matching** the installed profile (Metal build on Metal path, etc.).
- Local loopback control for watchers.

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

---

### 2.6 Typed YAML + tests

- Library-backed YAML; round-trip + snapshots for bundle outputs.

---

### 2.7 Integration tests (revised)

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
- Model hash verify on first run; **resume** partial downloads.
- Tool execution: least privilege; **no Docker required**—use OS sandbox primitives.
- APC timing: documented for multi-user edge case; sovereign default is single-user.
- Secrets: env + OS keychain hooks in binary, not plaintext in manifest.

---

## 8) Open Engineering Decisions

1. **vLLM distribution** (per **stage-2 profile**): vendored Python + wheels inside each large bundle; **Metal** macOS build vs **CUDA/CPU** others—separate CI matrices per profile.
2. **Metal on macOS**: confirm upstream/build pipeline for a **pinned** vLLM (or supported fork) for Apple GPU; define exact `macos-metal` vs `macos-fallback` probe matrix (OS version, chip, driver).
3. **Apple / Windows signing**: sign **dropper** and **stage-2** layout; notarization for macOS dropper (stapling policy).
4. **Exact vLLM memory knobs** at pinned version (map `memory` manifest → engine args).
5. **Dropper implementation language** (Rust/Go/C++) vs size budget—must stay **< 5 MB** with HTTPS + verify deps.
6. **Offline**: whether dropper supports `--bundle-path ./preseed.zip` to skip network (product choice).

Link ADRs after resolution.
