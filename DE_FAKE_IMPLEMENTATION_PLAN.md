# De-Fake Implementation Plan

## Purpose

This plan replaces all prototype behavior with production-grade server-side components that real users can trust for packaging, training, deployment, and multi-agent operations.

It explicitly addresses:

1. Real binary builder pipeline (Windows/macOS/Linux)
2. Real train/infer backend (adapters, checkpoints, GPU jobs)
3. Real supernode + thin client protocol
4. Hardened API contract and error model
5. Typed YAML serialization + contract tests
6. Integration tests proving real artifacts (not stubs)

---

## 0) Current Gaps to Remove

### Fabrications to eliminate
- Script-written files named `agent.exe` instead of real PE/Mach-O/ELF artifacts.
- Toy training loops used as stand-ins for model tuning.
- Metadata-only model/dataset references with no actual model lifecycle.
- In-bundle “multi-agent” represented as simple JSON append.
- Supernode mode represented as text commands only.

### Reliability gaps
- Weak request validation and implicit 500 behavior.
- Manual YAML string assembly vulnerable to drift.
- No artifact signing, provenance, reproducibility checks.
- No queueing/idempotency/retry policy for long-running jobs.

---

## 1) Target Production Architecture

## 1.1 Control Plane (Server-side only)

### Components
- `AgentSpec API` (input validation, schema versioning, sync response)
- `Build Orchestrator API` (starts package jobs)
- `Training Orchestrator API` (starts/resumes training jobs)
- `Artifact Registry API` (manifest + signatures + checksums)
- `Supernode API` (agent registration, tenancy, auth, dispatch)

### Storage
- Postgres: job states, agent metadata, tenant bindings, audit logs
- Object storage: checkpoints, adapters, final binaries, manifests
- Redis/queue: long-running jobs and retry orchestration

### Job workers
- Build worker (cross-compile + signing)
- Training worker (GPU-backed training + validation)
- Publish worker (artifact promotion, provenance stamping)

## 1.2 Runtime Plane

### Single binary runtime modes
- `agent --train` (training orchestration hook)
- `agent --run` (normal inference/runtime mode)
- `agent --agent add` (in-bundle profile growth mode)
- `agent --mode thin-client` (supernode-connected mode)

### Embedded services in runtime
- Embedded LLM serving layer
- Embedded LiteLLM routing with cache + circuit-break fallback
- Tool-calling module + mutable Jina template hooks
- KV-cache update APIs guarded by policy and version checks

---

## 2) Detailed Implementation Plan

## 2.1 Replace fake binary generation with real builder pipeline

### Deliverables
- Real builder service in Rust or Go (recommended Rust for reproducible static outputs).
- Per-target outputs:
  - Windows: PE `.exe`
  - macOS: Mach-O app/binary
  - Linux: ELF binary
- Build manifest per artifact: SHA256, build-id, toolchain version, schema version.
- Signing pipeline:
  - Windows Authenticode
  - macOS codesign + notarization flow support
  - Linux detached signature + checksum verification

### Steps
1. Introduce `build_jobs` table and state machine (`queued`, `building`, `signed`, `failed`, `published`).
2. Create build worker with cross-target matrix and deterministic flags.
3. Produce `artifact-manifest.json` for each target.
4. Sign artifacts and verify signatures in CI before publish.
5. Publish to artifact registry with immutable version IDs.

### Acceptance criteria
- `agent` binaries run natively on all targets without interpreter dependency.
- Build provenance and signatures are verifiable from API.
- Re-running same source + config yields identical checksums (or documented deterministic variance).

---

## 2.2 Replace toy trainer with real train/infer backend

### Deliverables
- Training service with adapter-based finetuning (QLoRA/Lora adapters).
- Dataset ingest pipeline with schema validation and split strategy.
- Checkpoint manager (resume, rollback, retention policy).
- Evaluation suite (task metrics + safety checks).

### Steps
1. Add `training_jobs` with checkpoint pointer, GPU assignment, retry count.
2. Implement dataset staging/validation pipeline.
3. Implement training runner supporting:
   - base model fetch
   - adapter initialization
   - periodic checkpoint save
   - metric logging
4. Add evaluation step gating promotion of trained artifacts.
5. Store model card + training report linked to artifact version.

### Acceptance criteria
- Real training jobs can run for long durations with resume-on-failure.
- Produced adapters/checkpoints are loadable by runtime binary.
- Training/inference versions are immutable and traceable.

---

## 2.3 Implement real supernode + thin client protocol

### Deliverables
- Supernode auth model (service tokens + tenant scoping).
- Thin-client handshake protocol and heartbeat lifecycle.
- Queue-backed dispatch with retry + dead-letter policy.
- Observability for request path (trace id across edge/supernode/runtime).

### Steps
1. Define protocol schemas (register, heartbeat, invoke, tool-call, error).
2. Add tenant-scoped auth middleware.
3. Implement dispatch queue + worker pull model.
4. Add idempotency keys for invoke requests.
5. Add structured telemetry events for every state transition.

### Acceptance criteria
- Thin clients can reliably reconnect and resume queued work.
- Multi-tenant isolation is enforced at auth + data layers.
- Failed jobs retry deterministically and land in dead-letter queue on exhaustion.

---

## 2.4 Harden API contract and errors

### Deliverables
- Route-level parse with zod and typed error envelopes.
- Explicit 4xx for validation/auth/business rule violations.
- Explicit 5xx with correlation IDs and safe error payloads.

### Steps
1. Define `ApiError` envelope with `code`, `message`, `details`, `requestId`.
2. Parse incoming payload at route boundary before service call.
3. Centralize error mapping middleware.
4. Add request ID propagation and structured logging.

### Acceptance criteria
- Invalid payloads never reach service layer.
- Error responses are deterministic and documented.
- Every failure is traceable via request ID.

---

## 2.5 Swap manual YAML assembly for typed serializer + tests

### Deliverables
- Typed serializer from schema object to YAML via library.
- Canonical ordering and stable formatting rules.
- Round-trip parse tests and backward compatibility tests by schema version.

### Steps
1. Replace manual line-by-line assembly with schema-aware serializer.
2. Add contract fixtures for representative agent requests.
3. Add snapshot + round-trip tests (`object -> yaml -> object`).
4. Version-lock contract output fields for RSC consumers.

### Acceptance criteria
- YAML output is stable, escaped correctly, and round-trippable.
- Schema upgrades include compatibility tests.

---

## 2.6 Add integration tests proving real artifacts

### Deliverables
- CI integration suite that:
  - builds real target artifacts,
  - verifies signatures/checksums,
  - runs training job against real backend,
  - runs runtime inference against trained artifacts,
  - tests thin-client/supernode path.

### Steps
1. Add ephemeral environment orchestration for Postgres/Redis/object storage.
2. Add test fixture dataset and deterministic training config.
3. Assert artifact format per target (PE/Mach-O/ELF checks).
4. Assert manifest/signature verification passes.
5. Assert runtime exits non-zero if training artifact mismatch/version mismatch.

### Acceptance criteria
- CI fails if any artifact is script-stubbed or unsigned.
- End-to-end tests validate real training + real runtime coupling.

---

## 3) Server-Side Interfaces for RSC Consumers

## 3.1 Keep existing purpose, evolve interfaces

### `POST /api/agent-spec`
- Input: user request + LLM output + optional repo contexts
- Output: normalized `AgentSpec`, YAML, response contract
- New behavior: strict route-level validation + typed errors

### `POST /api/agent-builds`
- Input: spec version + target matrix + signing profile
- Output: `buildJobId`

### `POST /api/agent-train`
- Input: artifact version + dataset config + adapter config
- Output: `trainingJobId`

### `POST /api/agent-runtime/register`
- Input: runtime capability profile
- Output: auth token + supernode lease

### `GET /api/jobs/:id`
- Unified job status endpoint for build/train/publish

---

## 4) Milestone Plan (10 Weeks)

### Milestone 1 (Weeks 1-2): API hardening + YAML correctness
- Route-level zod parsing + error envelopes
- Typed YAML serializer + contract tests
- Job tables and base state machines

### Milestone 2 (Weeks 3-5): Real build pipeline
- Build workers + artifact manifests + signatures
- Multi-target outputs in CI with verification

### Milestone 3 (Weeks 6-8): Real training backend
- GPU training jobs + checkpoint manager + eval gating
- Runtime loading of versioned adapters/checkpoints

### Milestone 4 (Weeks 9-10): Supernode + thin client
- Auth/tenancy, queueing, retries, observability
- Full integration tests including thin-client dispatch

---

## 5) Definition of Done (Strict)

The implementation is considered real only if all conditions pass:

1. Produced artifacts are native signed binaries for each target platform.
2. Training uses actual model pipeline and persists resumable checkpoints.
3. Runtime can only execute when artifact/training version compatibility checks pass.
4. Supernode/thin-client flows are authenticated, tenant-scoped, retriable, and observable.
5. API boundary enforces strict validation and explicit error semantics.
6. YAML generation is typed, round-trippable, and covered by contract tests.
7. CI integration tests verify real artifact formats and reject script stubs.

---

## 6) Immediate Next PR Breakdown

1. PR A: API hardening + error envelope + request IDs
2. PR B: typed YAML serializer + contract fixtures/tests
3. PR C: build job state machine + artifact manifest model
4. PR D: initial build worker and signed artifact publish
5. PR E: training job orchestration + checkpoint manager
6. PR F: supernode protocol + thin-client registration/invoke
7. PR G: full integration suite and release gates
