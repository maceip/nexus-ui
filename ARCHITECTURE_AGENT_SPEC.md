# Agent Packaging Architecture (Server-Side)

## 1) Restated Request

The server architecture outputs a **self-sufficient, portable runtime contract**:

- **Two-stage distribution:** a per-platform **dropper** native binary (**under 5 MB**) **probes** the machine and downloads the correct **full bundle**—e.g. on macOS a **Metal** build of the vLLM-backed runtime when hardware and OS support it, otherwise a documented **fallback** profile; on Windows a **Windows**-specific bundle (CUDA vs CPU profiles may follow the same probe pattern). Stage 2 is the large, copyable install tree (`agent-runtime`, vendored Python if needed, weights, manifest).
- **No required third-party runtime** (Docker, Kubernetes, etc.). After stage 2 is materialized, the user may **copy that directory** (thumb drive, zip, rsync, large transfer) and run **native** binaries—same OS/arch expectations as any other shipped application. Large total size (e.g. **tens of GB** for weights) is explicitly allowed for stage 2.
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
- `artifacts.dropper_executable` — per-platform tiny installer (< 5 MB budget; CI size gate)
- `artifacts.native_executable` — stage-2 `agent-runtime` (per profile if needed)
- **Channel index** — not emitted only by Next: build pipeline publishes **schema-versioned** `bundles.json` (see implementation plan §1.0.1): `profiles[]` with `stage2_archive_url`, `stage2_archive_sha256`, `stage2_archive_bytes`, predicates (`requires_metal`, etc.); dropper bootstrap URL priority (CLI → env → embedded → sidecar file)
- **Install root** — stage-2 **`manifest.json` directory** is the canonical root for all relative paths; `bundle_schema_version` + **`distribution.profile_id`** must match the installed profile (same string as `bundles.json` `profiles[].profile_id`)

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

1. **Dropper** per OS: < 5 MB, correct **profile selection** (e.g. macOS Metal vs fallback, Windows bundle).
2. **Stage 2** portable tree + **native** `agent-runtime`; **no Docker** in user path.
3. vLLM APC on; one model load; MTP role switches.
4. **Memory governor** honors `manifest.memory` (admission control, caps, bounded download RAM).
5. Tier-1 OS coverage (Windows, macOS, Linux) for dropper + stage-2 profiles.

## 4) E2E Demonstration Shape

- Dropper passes size gate; mock `bundles.json` drives correct stage-2 selection
- Stage 2 contains `manifest.json` (with `memory`), `roles/`, `prefixes/`
- Native binaries pass format gate in CI
- Optional GPU: prefill / APC regression on stage 2
- **No** stub training; **no** supernode
