# Agent Packaging Architecture (Server-Side)

## 1) Restated Request

The server architecture outputs a **self-sufficient local bundle** contract:

- **One inference stack** on the machine: typically **one vLLM process** with **Automatic Prefix Caching (APC)** enabled, loading **one** base model (weights loaded once).
- **Multiple roles** (orchestrator, retriever, executor, etc.) run as **multi-tenant prefixes (MTP)**: each role uses a **structured, stable prefix layout** so shared prompt layers hash-identically and APC reuses KV across roles—**without reloading model weights** when switching roles.
- The bundle ships **manifest**, **role definitions**, **frozen prefix files**, **tool policies**, and **launchers** per OS (or an OCI image). There is **no** bundled “train this model” step and **no** supernode / thin-client remote control plane in this architecture.

vLLM APC is the standard mechanism for prefix reuse; see upstream docs: https://docs.vllm.ai/en/latest/features/automatic_prefix_caching/

## 2) Server Components

### A) Contract schema (`lib/server/agent-spec/schema.ts` — evolving to bundle contract)

The schema should encode a **bundle-first** workflow (names may shift to `bundle-spec` / `BundleSpec`):

- `manifest`: vLLM version pin, `enable_prefix_caching`, model id + **pinned revision**
- `roles[]`: role id, definition path, prefix layer ids
- `artifacts`: launcher executable(s) per platform, bundle layout version
- **Removed from target design**: `training_flag`, `requires_training` as product requirements; `expansion_mode` thin-client/supernode; `supernode_enabled`, `thin_client_command`

Legacy fields may remain temporarily behind a `schema_version` bump for migration.

### B) Spec service (`lib/server/agent-spec/service.ts`)

`generateBundleSpec(input)` (or renamed pipeline) should:

- Infer **roles** and shared vs role-specific context needs from user + LLM text
- Emit **MTP prefix plan** references (layer ids, content-addressed prefix files)
- Emit **vLLM launch fragment** (args compatible with APC)
- **Not** emit supernode URLs or training-before-run narratives

### C) YAML / JSON renderer (`lib/server/agent-spec/yaml.ts`)

Generated artifacts should include bundle manifest fragments and per-role YAML aligned with the MTP layout so downstream orchestration and RSC stay consistent.

### D) API boundary (`app/api/agent-spec/route.ts` or `/api/bundle-spec`)

POST continues to return server-normalized outputs for RSC/server-side callers, with strict validation and typed errors.

## 3) Validation Target

Done criteria focus on **one model load, many roles, APC-friendly prefixes**:

1. vLLM starts once with APC enabled per `manifest`.
2. Role switches reuse shared prefix layers; no second weight load.
3. Tool and policy boundaries are defined per role in the bundle.
4. Packaging emits launchable artifacts for Windows, macOS, and Linux (or documented container-only path).

## 4) E2E Demonstration Shape

The E2E harness should validate:

- bundle directory or image contains `manifest.json` and `roles/`
- launcher starts vLLM + controller smoke
- alternating requests across two roles show **prefix-stable** composition (token-prefix tests) and, on GPU CI, optional APC warm-path metrics
- **no** stub “training” loop and **no** supernode registration
