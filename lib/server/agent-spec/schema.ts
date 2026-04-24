import { z } from "zod";

const supportedPlatform = z.enum(["windows", "macos", "linux"]);

export const agentSpecSchema = z.object({
  schema_version: z.literal("1.2"),
  agent: z.object({
    name: z.string().min(1),
    objective: z.string().min(1),
    trigger: z.string().min(1),
    profile_id: z.string().min(1),
  }),
  artifacts: z.object({
    executable: z.string().min(1),
    requires_training: z.boolean(),
    training_flag: z.string().min(1),
    expansion_mode: z.enum(["multi-agent-in-bundle", "thin-client-to-supernode"]),
  }),
  runtime: z.object({
    target_platforms: z.array(supportedPlatform).min(1),
    runtime_stack: z.string().min(1),
    embedded_llm: z.object({
      required: z.boolean(),
      candidate_models: z.array(z.string().min(1)).min(1),
      selected_model: z.string().min(1),
    }),
    serving_layer: z.object({
      required: z.boolean(),
      api_style: z.enum(["local-http", "in-process", "grpc"]),
    }),
    lite_llm_router: z.object({
      required: z.boolean(),
      cache_enabled: z.boolean(),
      circuit_breaker_enabled: z.boolean(),
      openai_compatible_fallback: z.boolean(),
    }),
  }),
  tuning: z.object({
    kv_cache_update_api: z.object({
      required: z.boolean(),
      endpoints: z.array(z.string().min(1)),
    }),
    qlora_ready: z.boolean(),
    generated_fine_tuning_data: z.object({
      required: z.boolean(),
      strategy: z.string().min(1),
      source_datasets: z.array(z.string().min(1)),
    }),
  }),
  tools: z.object({
    tool_calling_required: z.boolean(),
    jina_template_api: z.object({
      mutable: z.boolean(),
      retrain_supported: z.boolean(),
    }),
  }),
  deployment: z.object({
    supernode_enabled: z.boolean(),
    thin_client_command: z.string().min(1),
    multi_agent_growth_command: z.string().min(1),
  }),
  delivery: z.object({
    end_state: z.string().min(1),
    validations: z.array(z.string().min(1)).min(1),
  }),
  contexts: z.object({
    github_repo: z.string().optional(),
    huggingface_repo: z.string().optional(),
  }),
  unresolved_questions: z.array(z.string()),
});

export type AgentSpec = z.infer<typeof agentSpecSchema>;
