# Agent Packaging Architecture (Server-Side)

## 1) Restated Request

The server architecture outputs a **self-sufficient, portable runtime contract**:

- **Two-stage distribution:** a per-platform **dropper** (**under 5 MB**) **probes** the machine, reads **`bundle_tier`** (**`S` | `M` | `L` | `XL`** — user or generator picks tier; default **`M`**), and downloads the matching **`profiles[]`** row from **`bundles.json`** (e.g. `macos-metal-M`, `windows-cpu-S`). **S** targets **≤300 MB** unpacked; **M** ≤3 GB; **L** ≤12 GB; **XL** large/workstation. Stage 2 is the copyable install tree (`Agent.app` / `agent-runtime`, vendored Python, weights, manifest).
- **No required third-party runtime** (Docker, Kubernetes, etc.). After stage 2 is materialized, the user may **copy that directory** (thumb drive, zip, rsync, large transfer) and run **native** binaries—same OS/arch expectations as any other shipped application. Large total size (e.g. **tens of GB** for weights) is explicitly allowed for stage 2.
- **Vendored Python is allowed when required** (e.g. for vLLM): ship a **pinned** interpreter and dependencies **inside** the portable tree. The user does **not** install Python on the host; the **native launcher** is still the documented entrypoint and may invoke the vendored stack as a subprocess.
- **One inference stack** on the machine: **one vLLM engine** with **Automatic Prefix Caching (APC)** enabled, **one model load**.
- **Multiple roles** use **Multi-Tenant Prefix (MTP)** layout: stable shared prompt layers + role-specific tails so APC reuses KV blocks across roles **without reloading weights**.
- The bundle ships **manifest** (including a **memory management policy**), **roles**, **frozen prefixes**, **tool policies**, and the **native launcher binary**. Optional: weights ship beside the binary or download on first run with hash verification.

vLLM APC: https://docs.vllm.ai/en/latest/features/automatic_prefix_caching/

There is **no** bundled training step, **no** supernode, and **no** thin-client control plane in the target design.

**Normative v1 detail** lives only in `DE_FAKE_IMPLEMENTATION_PLAN.md` (Frozen product choices + Appendix A): **`.tar.zst` only**, **Ed25519** index + embedded per-profile stage-2 sig, **dropper uses OS-native TLS** (WinHTTP / NSURLSession / system libcurl on Linux), **`chat_messages` MTP only**, **`FILES.sha256` required**, Next emits **`distribution.profile_id: "draft"`** until the release packer overwrites it.

**End-user UX (same doc):** fatal errors → **native GUI** (MessageBox / NSAlert / zenity) before exit; **Documents** folder **symlink/junction** to `current` + **open in Finder/Explorer** after install; macOS ships **`Agent.app`**; Windows/Linux embed **icons**; **first-run** `http://127.0.0.1:8765/setup` + **`user_config.json`**; default SKU favors **small** task-tuned models for tolerable CPU fallback and USB-sized payloads.

## 2) Server Components

### A) Contract schema (`lib/server/agent-spec/schema.ts` — evolving to `BundleSpec`)

The schema should encode:

- `manifest.vllm` — version pin, `enable_prefix_caching`, allowlisted args
- `manifest.model` — pinned revision, layout / download spec
- `manifest.memory` — **required** smart memory block (GPU caps, concurrency, APC priority roles, download chunking, optional spill paths)
- `roles[]`, prefix layer references
- `artifacts.dropper_executable` — per-platform tiny installer (< 5 MB budget; CI size gate)
- `artifacts.native_executable` — stage-2 launcher: **`Agent.app`** (macOS) or **`agent-runtime.exe`** / **`agent-runtime`** (Windows/Linux) per plan §A.2
- **Channel index** — build pipeline publishes **`bundles.json`** with **`bundle_tier`** on every row and **`profile_id`** ending in **`-S`**, **`-M`**, **`-L`**, or **`-XL`** (implementation plan §1.0.1–§1.0.3)
- **Install root** — **`manifest.json` directory**; **`distribution.profile_id`** + **`distribution.bundle_tier`** must match the installed CDN row

**Removed from target design:** training-first workflow, supernode / thin-client expansion.

### B) Spec service (`lib/server/agent-spec/service.ts`)

`generateBundleSpec(input)` should:

- Accept **`bundleTier`** (`S`|`M`|`L`|`XL`) and emit **`distribution.bundle_tier`** + tier-appropriate **`model`** / **`memory`** hints
- Infer roles and MTP prefix plan
- **Not** emit Docker-first or container-required instructions

### C) YAML / JSON renderer (`lib/server/agent-spec/yaml.ts`)

Emit bundle fragments consistent with portable layout and `memory` policy.

### D) API boundary (`app/api/agent-spec/route.ts` or `/api/bundle-spec`)

Strict validation, typed errors, `requestId`.

## 3) Validation Target

1. **Dropper** per OS: < 5 MB, correct **tier + profile** selection (`macos-metal-M` vs `macos-fallback-M`, etc.).
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
