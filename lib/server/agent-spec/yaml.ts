import YAML from "yaml";

import type { AgentSpec } from "@/lib/server/agent-spec/schema";

type NormalizedAgentSpec = Omit<AgentSpec, "contexts"> & {
  contexts: {
    github_repo: string;
    huggingface_repo: string;
  };
};

function normalizeForYaml(spec: AgentSpec): NormalizedAgentSpec {
  return {
    ...spec,
    contexts: {
      github_repo: spec.contexts.github_repo ?? "",
      huggingface_repo: spec.contexts.huggingface_repo ?? "",
    },
  };
}

export function toAgentSpecYaml(spec: AgentSpec): string {
  const normalized = normalizeForYaml(spec);
  return YAML.stringify(normalized, {
    lineWidth: 0,
    defaultStringType: "QUOTE_DOUBLE",
    defaultKeyType: "PLAIN",
  });
}

const RESPONSE_CONTRACT_TEMPLATE: NormalizedAgentSpec = {
  schema_version: "1.2",
  agent: {
    name: "",
    objective: "",
    trigger: "",
    profile_id: "",
  },
  artifacts: {
    executable: "agent.exe",
    requires_training: true,
    training_flag: "--train",
    expansion_mode: "multi-agent-in-bundle",
  },
  runtime: {
    target_platforms: ["windows", "macos", "linux"],
    runtime_stack: "",
    embedded_llm: {
      required: true,
      candidate_models: [],
      selected_model: "",
    },
    serving_layer: {
      required: true,
      api_style: "local-http",
    },
    lite_llm_router: {
      required: true,
      cache_enabled: false,
      circuit_breaker_enabled: true,
      openai_compatible_fallback: false,
    },
  },
  tuning: {
    kv_cache_update_api: {
      required: true,
      endpoints: [],
    },
    qlora_ready: true,
    generated_fine_tuning_data: {
      required: true,
      strategy: "",
      source_datasets: [],
    },
  },
  tools: {
    tool_calling_required: true,
    jina_template_api: {
      mutable: true,
      retrain_supported: true,
    },
  },
  deployment: {
    supernode_enabled: false,
    thin_client_command: "",
    multi_agent_growth_command: "",
  },
  delivery: {
    end_state: "Single binary agent is trained via --train and reused for growth.",
    validations: [],
  },
  contexts: {
    github_repo: "",
    huggingface_repo: "",
  },
  unresolved_questions: [],
};

export function buildAgentSpecResponseContract(): string {
  const preamble = [
    "# Respond with valid YAML only.",
    "# Fill every field you can infer.",
    "# Use empty string for unknown strings and [] for unknown arrays.",
    "# Do not omit required keys.",
    "",
  ].join("\n");

  const schemaYaml = YAML.stringify(RESPONSE_CONTRACT_TEMPLATE, {
    lineWidth: 0,
    defaultStringType: "QUOTE_DOUBLE",
    defaultKeyType: "PLAIN",
  });

  return `${preamble}${schemaYaml}`;
}
