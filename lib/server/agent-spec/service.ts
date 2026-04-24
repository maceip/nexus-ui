import "server-only";

import {
  type AgentSpec,
  type AgentSpecInput,
  agentSpecSchema,
} from "@/lib/server/agent-spec/schema";
import {
  buildAgentSpecResponseContract,
  toAgentSpecYaml,
} from "@/lib/server/agent-spec/yaml";

const FALLBACK_MODEL_CANDIDATES = [
  "google/gemma-3-4b",
  "qwen/qwen3-4b",
  "google/functiongemma-270m-it",
];

function includes(text: string, pattern: RegExp): boolean {
  return pattern.test(text.toLowerCase());
}

function extractObjective(text: string): string {
  const trimmed = text.trim();
  return trimmed.length > 0
    ? trimmed
    : "Build a runnable local-first automation agent.";
}

function extractAgentName(text: string): string {
  const normalized = text.toLowerCase();
  if (normalized.includes("email") && normalized.includes("otp")) {
    return "otp-mail-bridge-agent";
  }
  return "custom-local-agent";
}

function toProfileId(name: string): string {
  return `${name.replace(/[^a-z0-9-]/gi, "-").toLowerCase()}-v1`;
}

function extractHuggingFaceReferences(text: string): {
  models: string[];
  datasets: string[];
} {
  const refs = [...text.matchAll(/huggingface\.co\/(datasets\/)?([\w.-]+\/[\w.-]+)/gi)];
  const models = new Set<string>();
  const datasets = new Set<string>();

  for (const match of refs) {
    const kind = match[1];
    const repo = match[2]?.trim();
    if (!repo) continue;
    if (kind?.startsWith("datasets/")) datasets.add(repo);
    else models.add(repo);
  }

  return {
    models: [...models],
    datasets: [...datasets],
  };
}

function extractRuntimeStack(text: string): string {
  if (includes(text, /(litert-lm|literal-lm|lite[- ]?rt[- ]?lm)/i)) {
    return "litert-lm";
  }
  if (includes(text, /litellm/i)) return "litellm";
  return "local-embedded-runtime";
}

function extractExpansionMode(text: string): "multi-agent-in-bundle" | "thin-client-to-supernode" {
  if (includes(text, /(thin client|supernode|remote orchestrator|control plane)/i)) {
    return "thin-client-to-supernode";
  }
  return "multi-agent-in-bundle";
}

function buildMissingQuestions(input: AgentSpecInput, detectedDatasets: string[]): string[] {
  const questions: string[] = [];

  if (!includes(input.llmResponse, /(imap|gmail|outlook|exchange)/i)) {
    questions.push("Which email provider and auth method should the agent use?");
  }
  if (!includes(input.llmResponse, /(sms|telegram|slack|discord|signal)/i)) {
    questions.push("Where should one-time passwords be delivered?");
  }
  if (!includes(input.llmResponse, /(interval|poll|webhook|latency)/i)) {
    questions.push("What is the delivery latency target and polling strategy?");
  }
  if (detectedDatasets.length === 0) {
    questions.push("Which dataset should be used to generate and refine training data?");
  }

  return questions;
}

export function generateAgentSpec(input: AgentSpecInput) {
  const text = `${input.userRequest}\n${input.llmResponse}`;
  const refs = extractHuggingFaceReferences(text);

  const models = refs.models.length > 0 ? refs.models : FALLBACK_MODEL_CANDIDATES;
  const selectedModel = models[0] ?? FALLBACK_MODEL_CANDIDATES[0];
  const datasets = refs.datasets;
  const agentName = extractAgentName(text);
  const expansionMode = extractExpansionMode(text);

  const spec: AgentSpec = {
    schema_version: "1.2",
    agent: {
      name: agentName,
      objective: extractObjective(input.userRequest),
      trigger: includes(text, /as soon as|immediately|real time/i)
        ? "on_new_message"
        : "scheduled_poll",
      profile_id: toProfileId(agentName),
    },
    artifacts: {
      executable: "agent.exe",
      requires_training: true,
      training_flag: "--train",
      expansion_mode: expansionMode,
    },
    runtime: {
      target_platforms: ["windows", "macos", "linux"],
      runtime_stack: extractRuntimeStack(text),
      embedded_llm: {
        required: true,
        candidate_models: models,
        selected_model: selectedModel,
      },
      serving_layer: {
        required: true,
        api_style: "local-http",
      },
      lite_llm_router: {
        required: true,
        cache_enabled: includes(text, /cache|cached/i),
        circuit_breaker_enabled: true,
        openai_compatible_fallback: includes(text, /openai|fallback|third[- ]party/i),
      },
    },
    tuning: {
      kv_cache_update_api: {
        required: true,
        endpoints: ["POST /v1/kv-cache/patch", "POST /v1/kv-cache/reset"],
      },
      qlora_ready: includes(text, /qlora|lora|fine[- ]?tun/i),
      generated_fine_tuning_data: {
        required: true,
        strategy:
          "Synthesize task-specific instruction/output pairs from user stories and execution traces.",
        source_datasets: datasets,
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
      supernode_enabled: expansionMode === "thin-client-to-supernode",
      thin_client_command: "agent.exe --mode thin-client --connect supernode",
      multi_agent_growth_command: "agent.exe --agent add --profile <profile-id>",
    },
    delivery: {
      end_state: "A single cross-platform binary is produced and trained via --train before runtime execution.",
      validations: [
        "agent.exe --train must complete successfully before agent.exe runtime mode is allowed to start.",
        "The same binary must support agent growth without producing another fat executable.",
        "Expansion must use either thin-client-to-supernode mode or multi-agent-in-bundle mode.",
        "Packaging must emit binaries for windows, macos, and linux.",
      ],
    },
    contexts: {
      github_repo: input.contexts?.github,
      huggingface_repo: input.contexts?.huggingface,
    },
    unresolved_questions: buildMissingQuestions(input, datasets),
  };

  const parsed = agentSpecSchema.parse(spec);

  const executableValidation = {
    executable: parsed.artifacts.executable,
    trainCommand: `${parsed.artifacts.executable} ${parsed.artifacts.training_flag}`,
    mustTrainBeforeRun: parsed.artifacts.requires_training,
    expansionMode: parsed.artifacts.expansion_mode,
  };

  return {
    spec: parsed,
    yaml: toAgentSpecYaml(parsed),
    responseContractYaml: buildAgentSpecResponseContract(),
    executableValidation,
  };
}
