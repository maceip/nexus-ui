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

## 0) Codebase Inventory (Today)

Use these paths as the integration surface for every workstream.

| Area | Current implementation | Notes |
|------|------------------------|-------|
| Agent spec schema | `lib/server/agent-spec/schema.ts` | Zod `agentSpecSchema`; `schema_version: "1.2"` |
| Spec generation | `lib/server/agent-spec/service.ts` | Heuristics on `userRequest` + `llmResponse`; always `artifacts.executable: "agent.exe"` |
| YAML emission | `lib/server/agent-spec/yaml.ts` | Manual string lines + `JSON.stringify` for quoting (not a YAML library) |
| HTTP API | `app/api/agent-spec/route.ts` | `POST` parses JSON with **no** `AgentSpecInput` zod parse; no error envelope |
| Architecture doc | `ARCHITECTURE_AGENT_SPEC.md` | Describes intended contract; keep in sync after changes |
| E2E harness | `scripts/e2e-agent-binaries.sh` | Writes a **Node script** to `.artifacts/e2e/windows/agent.exe` — the canonical “fake binary” to eliminate |

Other API routes (`app/api/chat/route.ts`, etc.) follow patterns you should mirror for validation (local request types exist; agent-spec does not).

---

## 0.1) Current Gaps to Remove

### Fabrications to eliminate

- **Script-named “binaries”**: `scripts/e2e-agent-binaries.sh` generates `agent.exe` as executable Node source (see inline `agentScript` in the script). Replace with: CI downloads or builds a **native** artifact per OS, or fails.
- **Hard-coded executable name**: `generateAgentSpec` in `service.ts` sets `executable: "agent.exe"` for all platforms. Replace with: per-platform names from build registry (`agent.exe`, `agent`, `Agent.app/...`) or a single cross-compile story with documented naming.
- **Toy training**: E2E `train()` is a bag-of-words logistic loop, not HF/PEFT/QLoRA. Training service must call a real stack and persist checkpoints adapters the runtime can load.
- **Metadata-only lifecycle**: Spec references `selected_model` and `source_datasets` but nothing verifies download, checksum, license, or compatibility with a built binary version.
- **Thin client / supernode**: `deployment.thin_client_command` is a fixed string (`agent.exe --mode thin-client --connect supernode`). No registration, lease, queue, or wire protocol exists server-side.
- **Multi-agent in bundle**: E2E appends profile id to `agents-registry.json` only — no real profile isolation, secrets, or bundle layout.

### Reliability gaps

- **Agent-spec route**: `await req.json()` is unchecked; malformed body throws before `generateAgentSpec`, typically yielding opaque 500s.
- **YAML drift**: Adding a field to `AgentSpec` requires editing both `schema.ts` and `yaml.ts` by hand; easy to miss keys or ordering.
- **No signing / provenance**: No manifest, SBOM, or signature verification path.
- **No job orchestration**: No Postgres tables, queue, idempotency, or retry policy for build/train/publish.

---

## 1) Target Production Architecture

### 1.1 Control Plane (Server-side only)

#### Components

- **AgentSpec API** — input validation, schema versioning, synchronous normalized response (today: `POST /api/agent-spec`).
- **Build Orchestrator API** — enqueue package jobs, return `buildJobId` (new).
- **Training Orchestrator API** — enqueue/resume training jobs (new).
- **Artifact Registry API** — immutable version id, manifest, checksums, signatures, compatibility matrix (binary version × adapter version × model id).
- **Supernode API** — registration, auth, dispatch, tenant isolation (new; may be separate deployable service).

#### Storage

| Store | Responsibility |
|-------|----------------|
| **Postgres** | Job state machines, tenant/agent metadata, idempotency keys (unique constraints), audit log append-only table |
| **Object storage (S3-compatible)** | Checkpoints, LoRA adapters, final binaries, `artifact-manifest.json`, training reports, dataset snapshots (hashed) |
| **Redis (or queue broker)** | Job queues, lease/heartbeat keys, rate limits, short-lived idempotency cache for fast rejects |

#### Job workers

- **Build worker** — cross-compile matrix, reproducible flags, signing, manifest upload.
- **Training worker** — GPU job, checkpoint cadence, eval gate, writes model card + metrics to object storage + Postgres.
- **Publish worker** — promote immutable version, update registry index, attach provenance (git commit, build id, signing key id).

### 1.2 Runtime Plane

#### Single binary runtime modes (contract-level; implementation language TBD)

- `agent --train`
- `agent --run` (default inference)
- `agent --agent add <profile-id>`
- `agent --mode thin-client` with explicit supernode URL + credentials (replace placeholder `--connect supernode`)

#### Embedded capabilities (already described in `AgentSpec`; implementation must honor version pins)

- Embedded LLM serving, LiteLLM routing, tool calling, KV-cache APIs — **runtime must refuse start** if loaded adapter/build/manifest triple fails verification (see Definition of Done).

---

## 2) Detailed Implementation Plan

Each subsection below lists: **schema / storage**, **API**, **service logic**, **tests**, and **acceptance** so an engineer can implement without inferring scope.

---

### 2.1 Replace fake binary generation with real builder pipeline

#### Deliverables

- Builder producing **native** PE / Mach-O / ELF per target.
- `artifact-manifest.json` per build: `sha256`, `build_id`, `toolchain`, `target_triple`, `agent_spec_schema_version`, `git_sha`, `signed_by` (key id).
- Signing: Windows Authenticode; Apple codesign + notarization **hooks** (document CI secrets layout); Linux detached sig + SHA256SUMS file.

#### Data model (Postgres) — illustrative DDL

Implement via your migration tool (Prisma/Drizzle/Knex); columns are the contract:

```sql
-- build_jobs: one row per enqueue
CREATE TABLE build_jobs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL,
  agent_spec_hash TEXT NOT NULL,        -- hash of canonical AgentSpec JSON
  targets         TEXT[] NOT NULL,      -- e.g. {'windows-amd64','darwin-arm64','linux-amd64'}
  signing_profile TEXT NOT NULL,
  status          TEXT NOT NULL,        -- queued|building|signing|verifying|published|failed
  idempotency_key TEXT UNIQUE,
  error_code      TEXT,
  error_detail    JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE build_artifacts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  build_job_id  UUID NOT NULL REFERENCES build_jobs(id),
  target_triple TEXT NOT NULL,
  object_key    TEXT NOT NULL,          -- s3 key
  sha256        TEXT NOT NULL,
  manifest_key  TEXT NOT NULL,
  signature_bundle_key TEXT,            -- optional per-target
  UNIQUE (build_job_id, target_triple)
);
```

#### State machine (explicit transitions)

| From | To | Trigger |
|------|-----|---------|
| `queued` | `building` | Worker lease |
| `building` | `signing` | All target binaries exist + checksum recorded |
| `signing` | `verifying` | Signers finished (or skipped in dev profile) |
| `verifying` | `published` | Signature + manifest verification passed |
| * | `failed` | Any hard failure; set `error_code` from a fixed enum |

#### Build worker — implementation constraints

- **Language**: Rust or Go as stated; if Rust, prefer `cargo build --target <triple>` with locked `Cargo.lock`; record `rustc` version in manifest.
- **Determinism**: Document any non-determinism (timestamps); for reproducible builds, set `SOURCE_DATE_EPOCH` and disable embedding volatile build ids where possible.
- **Cross-compile**: Use explicit target triples; CI matrix must match `AgentSpec.runtime.target_platforms` semantics (map `windows` → `x86_64-pc-windows-msvc` etc. in one central config file).

#### API (new)

`POST /api/agent-builds`

- **Body (zod)**: `{ agentSpecVersion: string, spec: AgentSpec | { id: string }, targets: SupportedTriple[], signingProfile: string, idempotencyKey?: string }`
- **Response**: `{ buildJobId: string }` or `409` with same `buildJobId` for duplicate idempotency key.
- **Errors**: Use unified envelope (section 2.4).

#### Repository integration

- Add route `app/api/agent-builds/route.ts` (or under `app/api/v1/...` if versioning).
- Do **not** extend `generateAgentSpec` to perform builds synchronously; keep spec generation fast and enqueue async.

#### Acceptance criteria

- E2E or CI job fails if output is not valid PE/Mach-O/ELF (use `file` command, or parse magic bytes in Node/Python helper).
- Manifest and signatures verifiable via a small CLI or `GET /api/artifacts/:version/manifest`.
- Rebuild with same inputs yields documented checksum policy (identical or listed variance).

---

### 2.2 Replace toy trainer with real train/infer backend

#### Deliverables

- Training pipeline: base model fetch (pinned revision), QLoRA/LoRA config, eval metrics, **promotion gate** before adapter is linked to a release version.
- Checkpoint manager: periodic writes to object storage, resume token in Postgres, retention policy (e.g. keep last N + best eval).

#### Data model (Postgres)

```sql
CREATE TABLE training_jobs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL,
  base_model_id     TEXT NOT NULL,       -- e.g. HF repo@revision
  dataset_manifest  TEXT NOT NULL,       -- object key to validated manifest
  adapter_config    JSONB NOT NULL,      -- ranks, alpha, target modules
  status            TEXT NOT NULL,       -- queued|staging|running|evaluating|promoted|failed|cancelled
  gpu_pool          TEXT,
  checkpoint_key    TEXT,
  latest_step       INT,
  idempotency_key   TEXT UNIQUE,
  build_artifact_id UUID REFERENCES build_artifacts(id), -- optional: train against a specific binary build
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

#### Dataset pipeline (required steps)

1. **Ingest**: User-provided URLs or HF dataset id → snapshot to object storage with content hash.
2. **Validate**: Schema (columns, types), train/val split, PII/license flags per org policy.
3. **Manifest**: Write `dataset-manifest.json` with `sha256`, row counts, split ratios, license field.

#### Training worker — implementation sketch

- Container image with CUDA + pinned `transformers`/`peft`/`torch` versions.
- Entrypoint args: `training_job_id`, read config from env or sidecar JSON from object storage.
- Loop: train → eval → if metric threshold → set status `promoted` and write **immutable** `adapter_version` record; else `failed` with reason in JSON.

#### API (new)

`POST /api/agent-train`

- **Body**: `{ trainingJobSpec: { baseModel, datasetManifestKey, adapterConfig, evalThresholds }, idempotencyKey?: string }`
- **Response**: `{ trainingJobId }`

#### Link to `AgentSpec`

- Extend schema (bump `schema_version` to `1.3` when ready) with optional `artifacts.build_version` / `artifacts.adapter_version` once registry exists; until then, store ids only in API responses, not in heuristic `service.ts`.

#### Acceptance criteria

- Worker restart mid-job resumes from `latest_step` / last checkpoint key.
- Produced adapter loads in the **same** runtime major version as recorded in compatibility matrix.
- Model card JSON stored next to adapter in object storage.

---

### 2.3 Implement real supernode + thin client protocol

#### Deliverables

- **Auth**: Short-lived runtime tokens (JWT or macaroon-style) scoped to `tenant_id` + `agent_profile_id`; rotation on reconnect.
- **Transport**: Prefer WebSocket or HTTP/2 bidirectional stream with binary framing; document choice in `ARCHITECTURE_AGENT_SPEC.md`.
- **Dispatch**: Server-assigned work items with `idempotency_key` per invoke; at-least-once delivery with client-side dedup.

#### Message schema (minimum set)

Define protobuf or JSON Schema **versioned** (`supernode.protocol_version`):

| Message | Direction | Fields |
|---------|-----------|--------|
| `Register` | client → server | `runtime_capabilities`, `supported_spec_versions`, `build_id`, `adapter_version` |
| `RegisterAck` | server → client | `session_token`, `lease_ttl_seconds`, `heartbeat_interval_seconds` |
| `Heartbeat` | client → server | `session_token`, `queue_depth`, `last_ack_seq` |
| `Invoke` | server → client | `invoke_id`, `idempotency_key`, `tool`, `payload`, `deadline_ms` |
| `InvokeResult` | client → server | `invoke_id`, `status`, `result`, `error` (typed) |
| `Disconnect` | either | reason code |

#### Server components

- **Registration handler**: validate token, persist session row with expiry.
- **Dispatch queue**: Redis list or Kafka subject `tenant.{id}.invokes`; workers push; thin client long-polls or holds WebSocket subscription.
- **DLQ**: After max retries, move to `dead_letter_invokes` table with last error.

#### API (new)

`POST /api/agent-runtime/register`

- **Body**: `{ tenantCredential, capabilityProfile, buildArtifactVersion, adapterVersion }`
- **Response**: `{ sessionToken, supernodeWsUrl, leaseExpiresAt }`

Update `service.ts` so `thin_client_command` includes **placeholder substitution** documented for integrators, e.g. `agent --mode thin-client --supernode-url ${SUPERNODE_URL}` until UI injects values.

#### Acceptance criteria

- Heartbeat timeout marks session stale; new `Register` succeeds; queued work redispatched or cancelled per policy.
- Cross-tenant invoke leakage blocked by integration test (attempt invoke for wrong `tenant_id` → 403 + audit row).

---

### 2.4 Harden API contract and errors

#### Deliverables

- Zod parse **at HTTP boundary** for every JSON body (start with `app/api/agent-spec/route.ts`, mirror `ChatRequestBody` style in `chat/route.ts`).
- Typed error envelope and centralized mapper.

#### Types (implement in `lib/server/http/errors.ts` or similar)

```ts
export type ApiErrorBody = {
  error: {
    code: string;           // stable machine code, e.g. AGENT_SPEC_VALIDATION
    message: string;        // human safe
    details?: unknown;      // optional, zod flatten or field errors
    requestId: string;
  };
};
```

#### Route handler pattern (agent-spec)

1. `const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID()`.
2. `const parsed = agentSpecInputSchema.safeParse(await req.json())`.
3. If `!parsed.success` → `NextResponse.json({ error: { code: "...", message: "Invalid body", details: parsed.error.flatten(), requestId } }, { status: 400 })`.
4. Call `generateAgentSpec(parsed.data)` inside `try/catch`; map known failures to 4xx/5xx with envelope.

#### `AgentSpecInput` schema

Add `lib/server/agent-spec/input-schema.ts`:

- `userRequest`: `z.string().min(1).max(…)`
- `llmResponse`: `z.string().min(1).max(…)`
- `contexts`: optional nested object with URL validation if needed

Export `agentSpecInputSchema` and use in route **only**; keep `AgentSpecInput` type as `z.infer<typeof agentSpecInputSchema>`.

#### Logging

- Structured log: `{ requestId, route, tenantId?, durationMs, status }` — use existing logger if present, else `console` with JSON line in worker.

#### Acceptance criteria

- Fuzz tests: random JSON → never unhandled exception; always JSON error body with `requestId`.
- OpenAPI or `README` snippet listing codes for `POST /api/agent-spec` (optional but recommended).

---

### 2.5 Swap manual YAML assembly for typed serializer + tests

#### Deliverables

- Single source of truth: **`agentSpecSchema` → YAML** without maintaining parallel field lists in `yaml.ts`.

#### Implementation approach

1. Add dependency `yaml` (npm `yaml` package) **or** `zod-to-json-schema` + JSON stringify is **not** acceptable for YAML-specific escaping — use a real YAML serializer.
2. Replace `toAgentSpecYaml` implementation:
   - Build a plain object that satisfies the same shape as `AgentSpec` (already true).
   - `YAML.stringify(obj, { sortMapKeys: true, lineWidth: 0 })` (or equivalent) for stable key order.
3. Keep `yamlQuote` tests if you still need quoted strings for contract template literals in `buildAgentSpecResponseContract` — or generate that template from schema metadata once.

#### Tests (`lib/server/agent-spec/yaml.test.ts` or vitest/jest)

| Test | Assertion |
|------|-----------|
| Round-trip | `YAML.parse(toAgentSpecYaml(spec))` deep-equals spec for **golden** fixtures |
| Key order | Snapshot of YAML string for a frozen fixture (detect accidental reorder policy change) |
| Escaping | Strings with `:`, quotes, newlines round-trip |
| Schema bump | When `schema_version` changes, fixture set must be updated intentionally |

#### Contract fixtures

- Store `lib/server/agent-spec/__fixtures__/spec-otp-min.json` (canonical `AgentSpec` object) and matching `spec-otp-min.expected.yaml`.

#### Acceptance criteria

- Removing a field from `agentSpecSchema` causes compile failure or test failure when building YAML from typed object (no orphaned manual line in `yaml.ts`).

---

### 2.6 Add integration tests proving real artifacts

#### Deliverables

- CI workflow that **cannot pass** with the current `e2e-agent-binaries.sh` Node stub (either replace script entirely or add a **gate** step that validates magic bytes).

#### Concrete changes to `scripts/e2e-agent-binaries.sh`

1. After artifact generation, run **`file` / `go version -m` / `strings`** checks appropriate to OS (on Linux CI, at least validate ELF for linux target; for Windows PE use `hexdump` head or `objdump` if available).
2. If native build not available in lightweight CI, **split** into two jobs: `agent-spec-contract` (no binary) and `native-artifact-e2e` (runs only on runner with toolchain) — document in script header.

#### Ephemeral services (docker-compose for CI)

- Postgres + Redis + MinIO (S3 API).
- Seed migration for job tables.
- Run one build job to completion against a **hello-world** agent binary repo to keep CI fast.

#### Assertions

| Step | Check |
|------|-------|
| Build | Manifest `sha256` matches downloaded bytes |
| Train | Checkpoint file appears in MinIO at expected key |
| Coupling | Runtime binary exits non-zero when `adapter_version` mismatches manifest (negative test) |

#### Acceptance criteria

- Deliberately commit a text file named `agent.exe` and assert CI **fails** the format gate.

---

## 3) Server-Side Interfaces for RSC Consumers

### Versioning policy

- Prefix new routes with `/api/v1/...` **or** add `apiVersion` field in body until clients migrate.
- Bump `schema_version` in `agentSpecSchema` when adding required fields; document migration in `ARCHITECTURE_AGENT_SPEC.md`.

### `POST /api/agent-spec` (existing)

| Aspect | Specification |
|--------|----------------|
| Input | `AgentSpecInput` validated by zod (section 2.4) |
| Output | Unchanged shape `{ spec, yaml, responseContractYaml, executableValidation }` unless versioned; if breaking, add `v2` route |
| New behavior | Strict validation + error envelope; optional `requestId` echo |

### `POST /api/agent-builds` (new)

| Field | Type | Notes |
|-------|------|-------|
| `spec` | object or `{ id }` | Full spec inline or reference to stored spec by id |
| `targets` | string[] | Triples or enum mapped server-side |
| `signingProfile` | string | Maps to secret refs in worker |
| `idempotencyKey` | string? | Client-generated UUID |

### `POST /api/agent-train` (new)

| Field | Type | Notes |
|-------|------|-------|
| `baseModel` | `repo@revision` | Pinned |
| `datasetManifestKey` | string | Must exist in object storage |
| `adapterConfig` | object | Validated against training worker schema |

### `POST /api/agent-runtime/register` (new)

Returns connection parameters for thin client mode.

### `GET /api/jobs/:id` (new)

Unified status: `type: build|train|publish`, `status`, `progress`, `artifacts[]`, `errors[]`.

---

## 4) Milestone Plan (Phased)

Phases are **ordered dependencies**; calendar scheduling is left to the team.

| Phase | Scope | Exit criteria |
|-------|--------|-----------------|
| **1** | API hardening (`agent-spec` + error envelope + request IDs) + `AgentSpecInput` zod | All malformed bodies return 400 with `ApiErrorBody`; logs include `requestId` |
| **2** | Typed YAML + fixtures + round-trip tests | `yaml.ts` no longer hand-assembles spec YAML; snapshot tests green |
| **3** | Postgres migrations + `build_jobs` / `build_artifacts` + enqueue API + stub worker → real native build | At least one triple produces verifiable native binary in CI |
| **4** | Signing + manifest + registry GET | Signature verification in CI |
| **5** | `training_jobs` + dataset manifest + GPU worker + eval gate | Resume + promoted adapter artifact |
| **6** | Runtime compatibility check | Binary refuses mismatched adapter/version |
| **7** | Supernode protocol + register API + dispatch + DLQ | Integration test: register → invoke → result → idempotent retry |
| **8** | Full integration compose + E2E gate | Stub `agent.exe` text file rejected |

---

## 5) Definition of Done (Strict)

The implementation is considered real only if all conditions pass:

1. Produced artifacts are native signed binaries for each target platform (verified in CI).
2. Training uses actual model pipeline and persists resumable checkpoints.
3. Runtime can only execute when artifact/training version compatibility checks pass.
4. Supernode/thin-client flows are authenticated, tenant-scoped, retriable, and observable.
5. API boundary enforces strict validation and explicit error semantics.
6. YAML generation is typed, round-trippable, and covered by contract tests.
7. CI integration tests verify real artifact formats and reject script stubs.

---

## 6) PR Breakdown (Suggested)

| PR | Content | Touches (indicative) |
|----|---------|----------------------|
| **A** | `agentSpecInputSchema`, route zod parse, `ApiErrorBody`, request id | `app/api/agent-spec/route.ts`, new `input-schema.ts`, `http/errors.ts` |
| **B** | YAML library + `toAgentSpecYaml` rewrite + fixtures | `yaml.ts`, `package.json`, tests |
| **C** | Migrations `build_jobs` / `build_artifacts`, `POST /api/agent-builds`, enqueue only | `app/api/agent-builds/`, `db/` |
| **D** | Build worker + manifest + signing + publish | worker repo or `workers/build/` |
| **E** | `training_jobs`, dataset manifest validation, training worker | `workers/train/`, APIs |
| **F** | Supernode protocol + register + dispatch + thin client URL in spec | `service.ts`, new WS server or edge route |
| **G** | `docker-compose.ci.yml`, integration tests, E2E script gate | `scripts/`, `.github/workflows/` |

---

## 7) Security and Operations Checklist (Non-optional)

- **Secrets**: Signing keys only in worker KMS / CI secrets; never in `AgentSpec` YAML returned to browser.
- **Tenancy**: Every job row has `tenant_id`; RLS on Postgres if using shared DB.
- **Audit**: Append-only `audit_log` for register, train start, publish, failed auth.
- **Rate limits**: Per-tenant on enqueue endpoints (Redis token bucket).
- **PII**: Dataset manifest flags; training logs must not store raw emails by default in shared logs.

---

## 8) Open Engineering Decisions (Resolve Early)

Document outcomes in this file or `ARCHITECTURE_AGENT_SPEC.md`:

1. **Monorepo vs split worker repo** for Rust/Go builder.
2. **HF hub auth** in training worker (org tokens, OIDC).
3. **Apple notarization** in CI vs manual release lane.
4. **WebSocket vs gRPC** for supernode (firewall friendliness vs efficiency).

Once decided, link the ADR filename here for traceability.
