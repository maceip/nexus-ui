# De-Fake Implementation Plan

## Purpose

This plan replaces prototype behavior with a **production-grade, self-sufficient runtime** that runs **entirely on the user’s machine**. There is **no remote training service**, **no supernode**, **no thin-client control plane**, and **no required third-party runtime** (Docker, Podman, Kubernetes, etc. are **out of scope as dependencies**—the shipped product must be **copy-paste portable**).

**Vendored Python is allowed and expected when vLLM requires it:** the portable tree may include a **pinned, read-only Python runtime** (stdlib + wheels) used only by the shipped stack. The user must **not** install Python, `pyenv`, or `pip` on the host—that is what “self-sufficient” means. The **entrypoint** remains a **native launcher** (or platform equivalent); it may exec the vendored interpreter as an implementation detail.

### Portability invariant (non-negotiable)

- **One native executable** (PE / Mach-O / ELF) per supported OS, or a **documented equivalent** (e.g. signed `.app` bundle on macOS) that the user treats as a single artifact—the **user-facing** command to start the agent is this binary (it may spawn vendored Python + vLLM under the hood).
- The user can **copy the install directory to a thumb drive**, **rsync it**, **zip it**, or **email a link** to a large archive—the distribution model explicitly allows **tens of GB** (model weights + vendored runtime + tools); portability means **behavior**, not small download size.
- On a fresh machine: **extract → run** (or double-click where applicable) with **no** `docker pull`, **no** daemon, **no** admin-only dependency beyond what the OS already needs for GPU drivers.
- **Optional**: developers may use Docker **internally** for CI; that must never appear in end-user documentation as a requirement.

The core runtime idea is the **Multi-Tenant Prefix (MTP) architecture**: several **roles** share **one loaded model** and are distinguished by **structured, stable prompt prefixes** per role. That maximizes **Automatic Prefix Caching (APC)** in **vLLM** so switching roles reuses KV for shared prefixes—**without reloading weights**.

References (external, for implementers):

- vLLM Automatic Prefix Caching: https://docs.vllm.ai/en/latest/features/automatic_prefix_caching/
- APC is enabled via `enable_prefix_caching=True` (Python) or `--enable-prefix-caching` (CLI), subject to the **pinned** vLLM version in `manifest.json`.

This document explicitly addresses:

1. **Portable native binary** + **self-sufficient bundle** (manifest, roles, prefixes, tools, model pin).
2. **MTP + vLLM APC** — prefix design, router/skill model, observability, APC security notes.
3. **Smart memory management** — GPU/CPU budget, cache pools, backpressure, spill/eviction, graceful degradation.
4. **Hardened API contract** for the **spec server** (this Next app) that emits bundle manifests.
5. **Typed YAML serialization** + contract tests.
6. **Integration tests** proving native binaries (not script stubs) and, where CI has a GPU, APC-friendly behavior.

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

### 1.1 Conceptual model

```
┌──────────────────────────────────────────────────────────────────┐
│  Portable install (directory you can copy anywhere)               │
│  ├── agent-runtime          # single native binary (per OS)        │
│  ├── manifest.json         # pins model, vLLM args, memory policy │
│  ├── roles/  prefixes/  tools/                                   │
│  └── models/               # weights (optional: fetch on first run) │
└──────────────────────────────────────────────────────────────────┘
         │
         │  agent-runtime: Skill Router + memory governor + tool host
         ▼
┌────────────────────────────┐
│  vLLM (in-process or       │  enable_prefix_caching = true
│   child process you own)   │  one model load for MTP roles
└────────────────────────────┘
```

- **Skill Router** (inside the portable binary): maps events (file alert, CLI question, etc.) to `role_id`, composes MTP prompts, applies **memory policy** before calling vLLM.
- **One weight load**; role changes are **prefix changes**, not model swaps.

### 1.2 Control plane (server-side, this repo)

| Component | Responsibility |
|-----------|------------------|
| **BundleSpec API** | Validate inputs; emit `manifest.json`, roles, prefixes, YAML |
| **Build Orchestrator** (optional SaaS) | Reproducible tarball/zip of **portable directory** + signed binary |

**Not required to run the agent:** Postgres, Redis, object storage—only if you operate a **build service**.

### 1.3 Data plane (portable runtime)

| Piece | Responsibility |
|-------|----------------|
| **Native `agent-runtime` binary** | Router, memory governor, optional embedded HTTP for local “watcher” clients |
| **vLLM** | Linked or shipped as **pinned** dependency of the binary distribution (exact legal/shipping strategy is an open decision—see §8) |
| **Tool host** | Sandboxing via OS primitives (chroot, seccomp, Windows job objects, minimal privileges)—**Docker not assumed** |

### 1.4 Storage (optional SaaS only)

Postgres / object storage apply **only** if you host a remote bundle build registry—not for end-user inference.

---

## 2) Detailed Implementation Plan

### 2.1 Bundle manifest and directory contract

#### Deliverables

- **`manifest.json`** includes:
  - `vllm`: version pin, `enable_prefix_caching: true`, allowlisted CLI/engine args.
  - `model`: id + **pinned revision** + on-disk layout or first-run download spec.
  - `roles[]`, `apc` / `mtp` policy id.
  - **`memory`**: see §2.4 (required block—no silent defaults).

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

### 2.3 Packaging: portable native binary (no Docker)

#### Deliverables

- **Native binary** per tier-1 OS (Windows, macOS, Linux) that:
  - Locates `manifest.json` **relative to the executable** or via `AGENT_BUNDLE_DIR` (document one canonical rule, e.g. “manifest in cwd or next to binary”).
  - Verifies optional code signature / manifest hashes.
  - Ensures model weights exist (ship in `models/` or **first-run download** with hash verify + resume).
  - Starts or connects to **one** vLLM engine with APC per manifest.
  - Exposes a **local** loopback control channel (stdin/CLI, named pipe, or `127.0.0.1` HTTP) for watcher scripts—**lightweight on CPU** when idle (blocking I/O or event loop, no busy wait).

#### Explicit non-goals

- **No** `Dockerfile` in the user-facing quickstart.
- **No** requirement to install **system** Python/pip/pyenv for end users—the default is a **fully packaged** tree including **vendored Python** whenever the inference stack (e.g. vLLM) needs it.

#### Build / registry (narrowed)

- `build_artifacts` store **zip/tar of portable tree** + detached signatures—not OCI as the primary artifact.

#### Acceptance

- CI builds native binary; `file` / magic-byte gate rejects script stubs.
- Docs: “Copy this folder to another machine, same OS/arch, run `./agent-runtime`”—no container steps.

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
| Native binary gate | Magic bytes; reject Node-as-`.exe` |
| Bundle validator | manifest + `memory` + role refs |
| MTP prefix golden | Stable shared prefixes |
| Optional GPU | APC warm-path or prefill timing |

---

## 3) HTTP API Surface (spec server)

- `POST /api/bundle-spec` (or evolved `agent-spec`) emits portable bundle contract including `memory` defaults suggestion for common GPUs (optional helper, not blocking).

---

## 4) Milestone Plan (Phased)

| Phase | Scope | Exit criteria |
|-------|--------|----------------|
| **1** | `BundleSpec` + `memory` block in schema | Types + validator |
| **2** | Emit manifest + roles + MTP docs | Golden tests |
| **3** | API zod + errors | 400 envelope |
| **4** | Native `agent-runtime` + vLLM APC wiring | CI native artifact; copy-run doc |
| **5** | Memory governor + admission control + manifest-driven caps | Load test passes threshold |
| **6** | Signed portable zip/tar releases | Verify + checksum publish |

---

## 5) Definition of Done (Strict)

1. **Portable**: User can copy the install tree to another machine (same OS/arch), run **one native binary**, no Docker.
2. **One model load**, MTP roles, **vLLM APC enabled**; no weight reload on role switch.
3. **Smart memory**: `manifest.json` `memory` policy enforced; queue/backpressure; documented VRAM floors; bounded download buffering for huge weights.
4. No training/supernode in product contract.
5. Spec server: strict validation + typed errors.
6. Contract tests for YAML/JSON bundle outputs.
7. CI rejects non-native stub binaries.

---

## 6) PR Breakdown (Suggested)

| PR | Content |
|----|---------|
| **A** | `BundleSpec` + `memory` zod + remove container-first wording |
| **B** | Manifest emission + memory defaults templates |
| **C** | API hardening |
| **D** | `docs/mtp-prefix-v1.md` + prefix builder tests |
| **E** | Native `agent-runtime` + vLLM integration (no Docker in user path) |
| **F** | Memory governor + integration tests |
| **G** | Release: signed portable archive + checksums |

---

## 7) Security and Operations

- Model hash verify on first run; **resume** partial downloads.
- Tool execution: least privilege; **no Docker required**—use OS sandbox primitives.
- APC timing: documented for multi-user edge case; sovereign default is single-user.
- Secrets: env + OS keychain hooks in binary, not plaintext in manifest.

---

## 8) Open Engineering Decisions

1. **vLLM distribution** (pick one primary per platform; document in README):
   - **Recommended default:** **vendored Python** + pinned `vllm`/torch/cuda wheels inside the portable tree, launched by the native entrypoint (no host `pip install`).
   - Alternatives only if proven for your pin: static link, bundled `.so` only—do not block shipping on exotic layouts if vendored Python is reliable.
2. **Apple / Windows signing** and notarization lanes (sign **both** the native launcher and, where required, the vendored runtime layout).
3. **Exact vLLM memory knobs** available at the pinned version (map `memory` manifest → engine args).
4. **Single binary vs thin directory** (binary + `python/` + `lib/`): both satisfy portability if documented as **one copyable unit**; vendored Python implies a **multi-file tree**—that is still “portable.”

Link ADRs after resolution.
