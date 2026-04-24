import { describe, it, expect } from "vitest";
import YAML from "yaml";

import specOtpMin from "@/lib/server/agent-spec/__fixtures__/spec-otp-min.json";
import { agentSpecSchema, type AgentSpec } from "@/lib/server/agent-spec/schema";
import {
  buildAgentSpecResponseContract,
  toAgentSpecYaml,
} from "@/lib/server/agent-spec/yaml";

function parsedFixture(): AgentSpec {
  return agentSpecSchema.parse(specOtpMin);
}

describe("toAgentSpecYaml", () => {
  it("round-trips deeply equal to the typed spec", () => {
    const spec = parsedFixture();
    const yaml = toAgentSpecYaml(spec);
    const parsed = YAML.parse(yaml);
    expect(parsed).toEqual({
      ...spec,
      contexts: {
        github_repo: spec.contexts.github_repo ?? "",
        huggingface_repo: spec.contexts.huggingface_repo ?? "",
      },
    });
  });

  it("matches a stable snapshot for the frozen fixture (detects reorder drift)", () => {
    const spec = parsedFixture();
    const yaml = toAgentSpecYaml(spec);
    expect(yaml).toMatchInlineSnapshot(`
      "schema_version: "1.2"
      agent:
        name: "otp-mail-bridge-agent"
        objective: "Forward email one-time passwords to SMS as they arrive."
        trigger: "on_new_message"
        profile_id: "otp-mail-bridge-agent-v1"
      artifacts:
        executable: "agent.exe"
        requires_training: true
        training_flag: "--train"
        expansion_mode: "multi-agent-in-bundle"
      runtime:
        target_platforms:
          - "windows"
          - "macos"
          - "linux"
        runtime_stack: "litert-lm"
        embedded_llm:
          required: true
          candidate_models:
            - "google/gemma-3-4b"
            - "qwen/qwen3-4b"
          selected_model: "google/gemma-3-4b"
        serving_layer:
          required: true
          api_style: "local-http"
        lite_llm_router:
          required: true
          cache_enabled: false
          circuit_breaker_enabled: true
          openai_compatible_fallback: false
      tuning:
        kv_cache_update_api:
          required: true
          endpoints:
            - "POST /v1/kv-cache/patch"
            - "POST /v1/kv-cache/reset"
        qlora_ready: true
        generated_fine_tuning_data:
          required: true
          strategy: "Synthesize task-specific instruction/output pairs from user stories and execution traces."
          source_datasets: []
      tools:
        tool_calling_required: true
        jina_template_api:
          mutable: true
          retrain_supported: true
      deployment:
        supernode_enabled: false
        thin_client_command: "agent.exe --mode thin-client --connect supernode"
        multi_agent_growth_command: "agent.exe --agent add --profile <profile-id>"
      delivery:
        end_state: "A single cross-platform binary is produced and trained via --train before runtime execution."
        validations:
          - "agent.exe --train must complete successfully before agent.exe runtime mode is allowed to start."
          - "The same binary must support agent growth without producing another fat executable."
          - "Expansion must use either thin-client-to-supernode mode or multi-agent-in-bundle mode."
          - "Packaging must emit binaries for windows, macos, and linux."
      contexts:
        github_repo: ""
        huggingface_repo: ""
      unresolved_questions:
        - "Which email provider and auth method should the agent use?"
        - "What is the delivery latency target and polling strategy?"
        - "Which dataset should be used to generate and refine training data?"
      "
    `);
  });

  it("escapes special characters (colons, quotes, newlines) round-trip cleanly", () => {
    const spec = parsedFixture();
    const tricky: AgentSpec = {
      ...spec,
      agent: {
        ...spec.agent,
        objective:
          'Handle input with: a colon, "double quotes", and a\nnewline in it.',
      },
      delivery: {
        ...spec.delivery,
        validations: [
          'plain',
          'with "quotes"',
          'with: colon',
          'with\nnewline',
        ],
      },
    };
    const yaml = toAgentSpecYaml(tricky);
    const parsed = YAML.parse(yaml);
    expect(parsed.agent.objective).toBe(tricky.agent.objective);
    expect(parsed.delivery.validations).toEqual(tricky.delivery.validations);
  });

  it("treats undefined context fields as empty strings", () => {
    const spec = parsedFixture();
    const withoutContexts: AgentSpec = {
      ...spec,
      contexts: {},
    };
    const yaml = toAgentSpecYaml(withoutContexts);
    const parsed = YAML.parse(yaml);
    expect(parsed.contexts).toEqual({
      github_repo: "",
      huggingface_repo: "",
    });
  });

  it("emits schema_version matching the schema literal (guards bumps)", () => {
    const spec = parsedFixture();
    const yaml = toAgentSpecYaml(spec);
    const parsed = YAML.parse(yaml);
    expect(parsed.schema_version).toBe("1.2");
    expect(parsed.schema_version).toBe(spec.schema_version);
  });
});

describe("buildAgentSpecResponseContract", () => {
  it("produces parseable YAML whose schema_version matches the current schema", () => {
    const contract = buildAgentSpecResponseContract();
    const doc = YAML.parse(contract);
    expect(doc.schema_version).toBe("1.2");
    expect(Array.isArray(doc.runtime.target_platforms)).toBe(true);
    expect(doc.runtime.target_platforms).toEqual(["windows", "macos", "linux"]);
  });
});
