# Agent Packaging Architecture (Server-Side)

## 1) Restated Request

The requested server architecture should output a simplified packaging contract where:

- there is one binary per platform (`agent.exe` on Windows and equivalents on macOS/Linux),
- that single binary is trained with `--train`,
- the same binary then runs the task in runtime mode,
- and adding a second agent should avoid creating another fat binary.

For multi-agent growth, the architecture supports two expansion choices:

1. **multi-agent-in-bundle**: register another agent profile inside the existing bundle,
2. **thin-client-to-supernode**: generate a thin client configuration that connects to a supernode.

## 2) Server Components

### A) Contract schema (`lib/server/agent-spec/schema.ts`)

The schema now encodes a single-executable workflow:

- `artifacts.executable`
- `artifacts.training_flag` (`--train`)
- `artifacts.expansion_mode`
- `agent.profile_id`
- `deployment.supernode_enabled`
- `deployment.thin_client_command`
- `deployment.multi_agent_growth_command`

This keeps the output directly consumable by server actions and React Server Components.

### B) Spec service (`lib/server/agent-spec/service.ts`)

`generateAgentSpec(input)` now:

- infers runtime/model/dataset details from user + LLM text,
- emits the single-binary packaging contract,
- sets training-first validation as `agent.exe --train` before runtime,
- sets expansion strategy to either thin client/supernode or in-bundle multi-agent growth.

### C) YAML renderer + contract template (`lib/server/agent-spec/yaml.ts`)

Both generated YAML outputs were updated to include the new single-binary and expansion fields so downstream prompting and orchestration stay aligned.

### D) API boundary (`app/api/agent-spec/route.ts`)

`POST /api/agent-spec` continues to return server-normalized outputs for RSC/server-side callers.

## 3) Validation Target

Done criteria now focus on one executable:

1. `agent.exe --train` must complete first,
2. `agent.exe` runtime mode must use the produced artifacts,
3. multi-agent growth must reuse the same bundle (or thin client mode),
4. packaging emits artifacts for Windows, macOS, and Linux.

## 4) E2E Demonstration Shape

The E2E harness now validates:

- single executable generation,
- training via `--train`,
- runtime inference from trained artifact,
- adding a second profile via `--agent add <profile-id>`.
