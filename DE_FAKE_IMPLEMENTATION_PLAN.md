# De-Fake Implementation Plan

## Purpose

This plan replaces prototype behavior with a **production-grade, self-sufficient agent bundle** that runs **entirely on the user’s machine** (or their chosen single host). There is **no remote training service**, **no supernode**, and **no thin-client control plane**.

The core runtime idea is the **Multi-Tenant Prefix (MTP) architecture**: several **roles** (agents, tools policies, style adapters, etc.) share **one loaded model** and are distinguished by **structured, stable prompt prefixes** per role. That layout maximizes **Automatic Prefix Caching (APC)** in **vLLM**: shared prefixes hit the prefix cache so later requests skip redundant prefill work—**without reloading weights** when switching roles.

References (external, for implementers):

- vLLM Automatic Prefix Caching: https://docs.vllm.ai/en/latest/features/automatic_prefix_caching/
- APC is enabled in serving via flags such as `--enable-prefix-caching` (CLI) or `enable_prefix_caching=True` (Python `LLM`).

This document explicitly addresses:

1. **Self-sufficient bundle** layout (model pins, configs, roles, vLLM launch contract, local tools).
2. **MTP + vLLM APC** — prefix design rules, scheduling, observability, and security implications of shared prefix caches.
3. **Real binary / container packaging** (Windows/macOS/Linux) for the **runtime** only (no training pipeline).
4. **Hardened API contract** for the **spec server** (Next app) that emits bundle manifests.
5. **Typed YAML serialization** + contract tests.
6. **Integration tests** that prove native artifacts and a **single vLLM process** serving multiple roles with measurable prefix reuse (where CI has a GPU).

---

## 0) Codebase Inventory (Today)

| Area | Path | Notes |
|------|------|-------|
| Agent spec schema | `lib/server/agent-spec/schema.ts` | Still encodes `training_flag`, `expansion_mode`, supernode fields — **must evolve** toward MTP bundle contract |
| Spec generation | `lib/server/agent-spec/service.ts` | Heuristics; hard-coded `agent.exe`; thin-client strings — **replace** with bundle + role prefix emitters |
| YAML | `lib/server/agent-spec/yaml.ts` | Manual assembly — replace with typed serializer (unchanged workstream goal) |
| HTTP API | `app/api/agent-spec/route.ts` | Unvalidated JSON body |
| Architecture | `ARCHITECTURE_AGENT_SPEC.md` | Describes train + supernode — **must align** with this plan |
| E2E | `scripts/e2e-agent-binaries.sh` | Node stub + toy “train” — **replace** with bundle smoke + optional vLLM APC check |

---

## 0.1) Gaps to Remove (Revised)

### Fabrications to eliminate

- **Fake “training”**: No `--train`, no toy logistic loop, no HF fine-tune story in the product contract unless it is **explicitly out of scope** (it is: weights are **prepared upstream**, bundle only **pins** revisions).
- **Supernode / thin client**: Remove `thin-client-to-supernode`, `supernode_enabled`, `thin_client_command`, and any server-side remote dispatch narrative.
- **Script-as-binary E2E**: `agent.exe` as a Node file must go; bundle entrypoint should be a **real** launcher (native or container) that starts **vLLM** + local agent controller per manifest.
- **“Multi-agent” as JSON append only**: Replace with **role registry** + **canonical prefix templates** so APC can reuse KV blocks across roles that share stable headers.

### Reliability and safety gaps

- **Unvalidated agent-spec POST** → opaque 500s.
- **Manual YAML** → schema drift.
- **APC side channels**: Shared prefix caches can leak timing across tenants on a **shared** GPU host; for **local single-user** bundles the primary risk is **cross-role** accidental prefix collision or **co-hosted** multi-user deployments. Plan must call out **cache salting / isolation** options for multi-user hosts (see §7).

---

## 1) Target Architecture

### 1.1 Conceptual model

```
┌─────────────────────────────────────────────────────────────┐
│  Self-sufficient bundle (directory or OCI image)           │
│  ├── manifest.json          # version, model pin, vLLM opts  │
│  ├── roles/                 # one definition per logical role│
│  │     ├── orchestrator.yaml                               │
│  │     ├── retriever.yaml                                  │
│  │     └── executor.yaml                                   │
│  ├── prefixes/              # frozen prefix text / tokenizer│
│  ├── tools/                 # local tool manifests + policies│
│  ├── models/                # OR download spec (HF commit sha)│
│  └── bin/                   # launcher(s) per OS             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                 ┌────────────────────────┐
                 │  vLLM (single process)  │
                 │  APC ON                 │
                 │  one weight load        │
                 └────────────────────────┘
```

- **One vLLM server** (or one in-process engine) loads **one** base model.
- **Roles** are not separate models; they are **routes** in your agent controller that build prompts using **role-specific suffixes** appended after a **shared multi-tenant prefix stack** (see §2.2).
- **MTP** means: intentionally design that stack so that **common layers** (system policy, safety, tool grammar, shared RAG context digest) are **byte-stable** across roles where possible, and **role-specific** content appears **after** shared layers so APC hits maximize.

### 1.2 Control plane (server-side, this repo)

Only what is needed to **author and validate** bundles—not to run inference in production for the end user:

| Component | Responsibility |
|-----------|------------------|
| **AgentSpec / BundleSpec API** | Validate inputs; emit `manifest.json` + role files + YAML for RSC |
| **Build Orchestrator** (optional) | Produce signed tarball/OCI from a frozen `BundleSpec` |
| **Artifact Registry** (optional) | Store bundle versions, SBOM, signatures |

**Removed:** Training orchestrator, training workers, dataset pipelines, supernode APIs, `POST /api/agent-train`, `POST /api/agent-runtime/register`.

### 1.3 Data plane (bundle runtime, not necessarily in this repo)

| Piece | Responsibility |
|-------|----------------|
| **vLLM** | Serves OpenAI-compatible HTTP; **APC enabled**; GPU memory holds one model + prefix cache |
| **Agent controller** | Maps user tasks → role; assembles prompts from `prefixes/` + live suffix; calls vLLM |
| **Tool host** | Executes local tools (filesystem, browser driver, etc.) per `tools/` policy |

### 1.4 Storage (when you add orchestration)

| Store | Use |
|-------|-----|
| Postgres | `bundle_build_jobs`, tenant ids, audit (if SaaS builds bundles for customers) |
| Object storage | Immutable bundle tarballs / OCI layers |
| Redis | Optional: rate limits on build API only |

---

## 2) Detailed Implementation Plan

### 2.1 Bundle manifest and directory contract

#### Deliverables

- **`manifest.json`** (versioned schema, e.g. `bundle_schema_version: "1.0"`) containing at minimum:
  - `vllm`: `{ "version_pin": "...", "enable_prefix_caching": true, "extra_args": [...] }` (args documented against a pinned vLLM release).
  - `model`: `{ "id": "org/model", "revision": "git_sha_or_tag", "quantization": "..." }`.
  - `roles`: ordered list of `{ "id", "definition_path", "prefix_layers": ["layer_a", "layer_b"] }`.
  - `apc`: `{ "shared_stack_id": "uuid-or-hash", "layering_policy": "mtp-v1" }`.
- **`roles/*.yaml`**: per-role objectives, allowed tools, temperature defaults, **suffix template** references (not full prompts inlined if they churn).
- **`prefixes/`**: files that are **content-addressed** (hash in filename) so the build is reproducible and the controller can assert “prefix file X is exactly what spec server emitted”.

#### Steps

1. Define Zod `bundleSpecSchema` (new) or extend `agentSpecSchema` with a breaking bump — pick **one** canonical spec name (`BundleSpec` recommended) and deprecate train/supernode fields in `ARCHITECTURE_AGENT_SPEC.md`.
2. Implement `generateBundleSpec(input)` (rename or wrap `generateAgentSpec`) that emits manifest + embedded role list + **no** training commands.
3. Add JSON Schema or zod export for `manifest.json` consumers written in Go/Rust if the launcher is not TypeScript.

#### Acceptance

- A fresh checkout can `validate-bundle ./out/bundle` (CLI to add) and exit 0 only if all hashes and cross-references resolve.

---

### 2.2 Multi-Tenant Prefix (MTP) layout for vLLM APC

#### Concept

vLLM APC reuses KV for **identical token prefixes** across requests (block granularity; see vLLM docs). MTP means you **engineer** prompts so that:

1. **Layer 0 — Global** (same for all roles on this bundle): e.g. system date format, safety policy, output format instructions. **Frozen** in bundle.
2. **Layer 1 — Shared task context** (optional): e.g. digest of retrieved docs for this session, **identical** across roles that participate in the same user session when you want reuse.
3. **Layer 2 — Role header**: short, stable delimiter + role id (constant per role).
4. **Layer 3 — Volatile user content**: user message, tool results — **not** reused across roles except via Layer 1.

Roles that only differ in Layer 3 still benefit from Layers 0–2. Roles with different Layer 2 trade some reuse—that is an explicit **product** decision.

#### Deliverables

- **Prefix composition spec** in repo: e.g. `docs/mtp-prefix-v1.md` describing concatenation order, tokenizer caveats (BPE stability), and max layer sizes to avoid blowing context.
- **Controller algorithm**: `buildPrompt(roleId, sessionContext) -> messages[]` that is deterministic given bundle + session state.
- **Metrics**: log `prompt_token_ids_length`, `estimated_apc_hit_ratio` if vLLM exposes stats endpoints for your pinned version; otherwise add lightweight timing (prefill ms) A/B with and without shared prefix artificially perturbed in tests.

#### Tests

- **Unit**: same Layer 0+1+2, different Layer 3 → prompt token prefix of first N blocks matches golden fixture.
- **Integration** (GPU CI): two roles, alternating requests 100×, assert median prefill latency for role B after warm role A is below baseline cold start by a threshold **or** assert vLLM-reported cache hit metric if available.

#### Security note (multi-user hosts)

- If multiple **human tenants** share one OS user or one vLLM process, APC + timing can create **cross-tenant** side channels (academic and industry awareness in 2025–2026). For **strict** multi-tenant SaaS on shared GPUs, document: separate vLLM processes, `cache_salt` / request-level isolation if supported in your vLLM pin, or disable APC for conflicting tenants. For **local single-user** bundle, document residual risk when running **untrusted** remote workloads against the same engine.

#### Acceptance

- Documented prefix layout with examples in `docs/mtp-prefix-v1.md`.
- CI proves **at least** prefix-token equality for shared layers; GPU job optional but recommended.

---

### 2.3 Packaging: self-sufficient launcher + vLLM

#### Deliverables

- **Per-OS launcher** (or single static binary) that:
  - Verifies `manifest.json` signature (if signed bundles enabled).
  - Ensures model files exist or runs **pinned** download (HF with commit sha).
  - Starts `vllm serve ... --enable-prefix-caching` with args from manifest (memory, tensor parallel, etc.).
  - Starts agent controller subprocess with `VLLM_BASE_URL` set.

#### Build / registry (narrowed scope)

- `build_jobs` / `build_artifacts` tables remain valid **only for bundling** (tarball/OCI), not training artifacts.
- Manifest lists **model revision** only; no `adapter_version` from training.

#### Acceptance

- CI produces PE/Mach-O/ELF **or** OCI image with `docker run` smoke: vLLM health + one completion per role without second weight load (verify single process count).

---

### 2.4 Harden API contract and errors

(Unchanged intent, narrowed examples.)

- Add `bundleSpecInputSchema` (or extend `agentSpecInputSchema`) with zod.
- `POST /api/agent-spec` may become `POST /api/bundle-spec` with backward-compatible alias during migration.
- Return `ApiErrorBody` on all validation failures (`requestId`, stable `code`).

#### Acceptance

- Fuzz POST bodies → never unhandled exception.

---

### 2.5 Typed YAML + tests

- Serialize `BundleSpec` / role YAML via library (`yaml` npm package).
- Round-trip and snapshot tests for `roles/*.yaml` and top-level bundle export.

---

### 2.6 Integration tests (revised)

| Test | Purpose |
|------|---------|
| Bundle validator | Hashes, cross-refs, vLLM arg allowlist |
| Native / OCI gate | Reject Node stub as “binary” |
| MTP prefix golden | Token prefix stability |
| Optional GPU | vLLM APC warm-path latency or cache metric |

Remove assertions about training checkpoints, supernode register, or adapter promotion.

---

## 3) HTTP API Surface (Revised)

### `POST /api/agent-spec` (interim) or `POST /api/bundle-spec` (target)

| Field | Behavior |
|-------|----------|
| Input | Validated zod; same `userRequest` / `llmResponse` / `contexts` or evolved fields |
| Output | `{ spec \| bundle, yaml, manifest?, roles?, responseContractYaml, validation }` — exact shape to version |

### `POST /api/agent-builds` (optional)

Body references **bundle** only: `{ bundleSpec, targets[], signingProfile, idempotencyKey? }` → `{ buildJobId }`.

### Removed endpoints

- `POST /api/agent-train`
- `POST /api/agent-runtime/register`
- `GET /api/jobs/:id` **unless** repurposed for `bundle_build_jobs` only

---

## 4) Milestone Plan (Phased)

| Phase | Scope | Exit criteria |
|-------|--------|----------------|
| **1** | Schema redesign: remove train/supernode; add `BundleSpec`, roles, vLLM/APC block | Types compile; docs updated |
| **2** | `generateBundleSpec` + YAML + manifest emission | Golden tests pass |
| **3** | API zod + error envelope | 400 on bad input; `requestId` always |
| **4** | Launcher + `vllm serve` wiring + example bundle | Local smoke doc |
| **5** | MTP prefix doc + controller + metrics hooks | Prefix tests + optional GPU job |
| **6** | Build registry + signed bundles (if SaaS) | CI verifies tarball + optional OCI |

---

## 5) Definition of Done (Strict, Revised)

1. Bundle runs **one** vLLM instance with **APC enabled** and **one** model load; switching roles does not reload weights.
2. **MTP prefix layout** is specified, implemented, and tested (at least token-prefix goldens; GPU APC test optional).
3. No training pipeline, no supernode, no thin-client protocol in product artifacts or public API.
4. Packaging produces **verifiable** native or OCI artifacts; stub scripts fail CI.
5. Spec / bundle API uses strict validation and typed errors.
6. YAML (or JSON) contract tests cover bundle outputs.
7. Security posture for APC on **shared** hosts is documented; default local bundle documents single-user assumption.

---

## 6) PR Breakdown (Suggested)

| PR | Content |
|----|---------|
| **A** | Schema: `BundleSpec`, remove train/supernode fields; bump `schema_version` |
| **B** | `generateBundleSpec`, `yaml.ts` typed emit, `manifest.json` builder |
| **C** | Route validation + `ApiErrorBody` |
| **D** | `docs/mtp-prefix-v1.md` + prefix builder module + unit tests |
| **E** | Launcher + example bundle + docker-compose for local vLLM |
| **F** | CI: bundle validator + native/OCI gate; optional GPU workflow |
| **G** | Optional: `bundle_build_jobs` + signed artifact publish |

---

## 7) Security and Operations (Revised)

- **Model supply chain**: pin HF revision; verify hashes in manifest.
- **Tool sandbox**: local tools run with OS-level boundaries (containers recommended).
- **APC multi-tenant timing**: see §2.2; for enterprise shared inference, add ADR on isolation vs performance.
- **Secrets**: API keys for cloud models (if any) stay out of bundle plaintext; use OS keychain integration in launcher where applicable.

---

## 8) Open Engineering Decisions

1. **Bundle transport**: raw directory vs single `.tar.zst` vs OCI only.
2. **Controller language**: TypeScript (reuse zod in-process) vs Rust sidecar.
3. **vLLM pin cadence**: how often to bump `vllm` minor and re-run APC regression tests.
4. **Role count limits**: max roles per bundle vs GPU memory for long shared prefixes.

Link ADRs here after resolution.
