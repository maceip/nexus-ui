# Agent Packaging Architecture (Server-Side)

## 1) Restated Request

The server architecture outputs a **self-sufficient, portable runtime contract**:

- **No required third-party runtime** (Docker, Kubernetes, etc.). The user experience is: **copy a directory** (thumb drive, zip, rsync, large email attachment link) and **run a native binary** on Windows, macOS, or Linux—same OS/arch expectations as any other shipped application. Large total size (e.g. **tens of GB** for weights) is explicitly allowed.
- **Vendored Python is allowed when required** (e.g. for vLLM): ship a **pinned** interpreter and dependencies **inside** the portable tree. The user does **not** install Python on the host; the **native launcher** is still the documented entrypoint and may invoke the vendored stack as a subprocess.
- **One inference stack** on the machine: **one vLLM engine** with **Automatic Prefix Caching (APC)** enabled, **one model load**.
- **Multiple roles** use **Multi-Tenant Prefix (MTP)** layout: stable shared prompt layers + role-specific tails so APC reuses KV blocks across roles **without reloading weights**.
- The bundle ships **manifest** (including a **memory management policy**), **roles**, **frozen prefixes**, **tool policies**, and the **native launcher binary**. Optional: weights ship beside the binary or download on first run with hash verification.

vLLM APC: https://docs.vllm.ai/en/latest/features/automatic_prefix_caching/

There is **no** bundled training step, **no** supernode, and **no** thin-client control plane in the target design.

## 2) Server Components

### A) Contract schema (`lib/server/agent-spec/schema.ts` — evolving to `BundleSpec`)

The schema should encode:

- `manifest.vllm` — version pin, `enable_prefix_caching`, allowlisted args
- `manifest.model` — pinned revision, layout / download spec
- `manifest.memory` — **required** smart memory block (GPU caps, concurrency, APC priority roles, download chunking, optional spill paths)
- `roles[]`, prefix layer references
- `artifacts.native_executable` — per-platform names or single binary + platform detection policy

**Removed from target design:** training-first workflow, supernode / thin-client expansion.

### B) Spec service (`lib/server/agent-spec/service.ts`)

`generateBundleSpec(input)` should:

- Infer roles and MTP prefix plan
- Emit **default `memory` suggestions** where possible (documented as starting points, not guarantees across all GPUs)
- **Not** emit Docker-first or container-required instructions

### C) YAML / JSON renderer (`lib/server/agent-spec/yaml.ts`)

Emit bundle fragments consistent with portable layout and `memory` policy.

### D) API boundary (`app/api/agent-spec/route.ts` or `/api/bundle-spec`)

Strict validation, typed errors, `requestId`.

## 3) Validation Target

1. Portable tree + **native** launcher; **no Docker** in user path.
2. vLLM APC on; one model load; MTP role switches.
3. **Memory governor** honors `manifest.memory` (admission control, caps, bounded download RAM).
4. Tier-1 OS coverage (Windows, macOS, Linux) for the shipped binary story.

## 4) E2E Demonstration Shape

- Bundle contains `manifest.json` (with `memory`), `roles/`, `prefixes/`
- Native binary passes format gate in CI
- Optional GPU: prefill / APC regression
- **No** stub training; **no** supernode
