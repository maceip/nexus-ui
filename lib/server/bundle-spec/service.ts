import "server-only";

import {
  type BundleManifest,
  type BundleSpec,
  type BundleTier,
  type DeviceClass,
  type Memory,
  type RoleDefinition,
  bundleSpecSchema,
  DRAFT_PROFILE_ID,
} from "@/lib/server/bundle-spec/schema";
import type { BundleSpecInput } from "@/lib/server/bundle-spec/input-schema";

const GIB = 1_073_741_824;

type TierDefaults = {
  host_ram_min_bytes: number;
  min_vram_bytes_gpu: number;
  gpu_utilization_cap: number;
  max_concurrent_requests: number;
  download_chunk_mb: number;
  suggested_device_class: DeviceClass;
};

const TIER_DEFAULTS: Record<BundleTier, TierDefaults> = {
  S: {
    host_ram_min_bytes: 4 * GIB,
    min_vram_bytes_gpu: 0,
    gpu_utilization_cap: 0,
    max_concurrent_requests: 1,
    download_chunk_mb: 8,
    suggested_device_class: "cpu",
  },
  M: {
    host_ram_min_bytes: 8 * GIB,
    min_vram_bytes_gpu: 8 * GIB,
    gpu_utilization_cap: 0.75,
    max_concurrent_requests: 2,
    download_chunk_mb: 16,
    suggested_device_class: "metal",
  },
  L: {
    host_ram_min_bytes: 16 * GIB,
    min_vram_bytes_gpu: 16 * GIB,
    gpu_utilization_cap: 0.85,
    max_concurrent_requests: 4,
    download_chunk_mb: 32,
    suggested_device_class: "gpu",
  },
  XL: {
    host_ram_min_bytes: 32 * GIB,
    min_vram_bytes_gpu: 48 * GIB,
    gpu_utilization_cap: 0.9,
    max_concurrent_requests: 8,
    download_chunk_mb: 64,
    suggested_device_class: "gpu",
  },
};

function includes(text: string, pattern: RegExp): boolean {
  return pattern.test(text.toLowerCase());
}

function extractHuggingFaceModel(text: string): string | undefined {
  const match = text.match(/huggingface\.co\/([\w.-]+\/[\w.-]+)/i);
  return match?.[1];
}

function buildMemory(tier: BundleTier): Memory {
  const d = TIER_DEFAULTS[tier];
  if (d.suggested_device_class === "cpu") {
    return {
      device_class: "cpu",
      host_ram_min_bytes: d.host_ram_min_bytes,
      min_vram_bytes: 0,
      gpu_memory_utilization_cap: 0,
      max_concurrent_requests: d.max_concurrent_requests,
      cpu_offload_policy: "none",
      download_chunk_mb: d.download_chunk_mb,
      apc_priority_roles: ["orchestrator"],
    };
  }
  return {
    device_class: d.suggested_device_class,
    host_ram_min_bytes: d.host_ram_min_bytes,
    min_vram_bytes: d.min_vram_bytes_gpu,
    gpu_memory_utilization_cap: d.gpu_utilization_cap,
    max_concurrent_requests: d.max_concurrent_requests,
    cpu_offload_policy: "none",
    download_chunk_mb: d.download_chunk_mb,
    apc_priority_roles: ["orchestrator", "executor"],
  };
}

function buildManifest(
  tier: BundleTier,
  modelId: string,
  revision: string,
): BundleManifest {
  const memory = buildMemory(tier);
  return {
    bundle_schema_version: "1.0.0",
    distribution: {
      profile_id: DRAFT_PROFILE_ID,
      bundle_tier: tier,
      stage2_archive_format: "tar.zst",
      dropper_min_version: "1.0.0",
      channel_url: "https://cdn.example.com/nexus-agent/bundles.json",
    },
    vllm: {
      package_version: "0.6.0",
      enable_prefix_caching: true,
      launch: [
        "serve",
        modelId,
        "--enable-prefix-caching",
        "--host",
        "127.0.0.1",
        "--port",
        "8000",
      ],
    },
    model: {
      id: modelId,
      revision,
      weights_relative_path: "models/weights",
      tokenizer_relative_path: "models/tokenizer",
    },
    memory,
    mtp: { policy_id: "mtp-v1", serialization_mode: "chat_messages" },
    roles: [
      {
        id: "orchestrator",
        definition_relative_path: "roles/orchestrator.yaml",
        prefix_layer_ids: ["global", "orchestrator_header"],
      },
      {
        id: "executor",
        definition_relative_path: "roles/executor.yaml",
        prefix_layer_ids: ["global", "executor_header"],
      },
    ],
    logging: { max_mb: 256 },
  };
}

function buildRoles(tier: BundleTier): RoleDefinition[] {
  const sampling = SAMPLING_BY_TIER[tier];
  return [
    {
      role_id: "orchestrator",
      sampling,
      tools_allowlist: [],
      mtp: { suffix_template_relative_path: "prefixes/orchestrator_suffix.txt" },
    },
    {
      role_id: "executor",
      sampling,
      tools_allowlist: [
        { id: "read_file", argv_template: ["cat", "{path}"] },
      ],
      mtp: { suffix_template_relative_path: "prefixes/executor_suffix.txt" },
    },
  ];
}

const SAMPLING_BY_TIER: Record<
  BundleTier,
  { temperature: number; max_prompt_tokens: number; max_total_tokens: number }
> = {
  S: { temperature: 0.0, max_prompt_tokens: 2048, max_total_tokens: 3072 },
  M: { temperature: 0.0, max_prompt_tokens: 8192, max_total_tokens: 12288 },
  L: { temperature: 0.0, max_prompt_tokens: 16384, max_total_tokens: 24576 },
  XL: { temperature: 0.0, max_prompt_tokens: 32768, max_total_tokens: 49152 },
};

function buildPrefixes(): Record<string, string> {
  return {
    global:
      "You are the local agent runtime. Follow the role system prompt strictly. Never output absolute filesystem paths from the host.\n",
    orchestrator_header:
      "Role: orchestrator. Decompose the user task into tool invocations. Prefer deterministic, single-shot plans.\n",
    executor_header:
      "Role: executor. Run the requested tool with exactly the arguments provided. Do not invent arguments.\n",
  };
}

export function generateBundleSpec(input: BundleSpecInput): BundleSpec {
  const text = `${input.userRequest}\n${input.llmResponse}`;
  const modelId = extractHuggingFaceModel(text) ?? defaultModelForTier(input.bundleTier);
  const revision = includes(text, /revision:([\w.-]+)/i)
    ? (text.match(/revision:([\w.-]+)/i)?.[1] ?? "main")
    : "main";

  const spec: BundleSpec = {
    spec_version: "1.0",
    bundle_tier: input.bundleTier,
    manifest: buildManifest(input.bundleTier, modelId, revision),
    roles: buildRoles(input.bundleTier),
    prefixes: buildPrefixes(),
  };

  return bundleSpecSchema.parse(spec);
}

function defaultModelForTier(tier: BundleTier): string {
  switch (tier) {
    case "S":
      return "google/functiongemma-270m-it";
    case "M":
      return "google/gemma-3-4b";
    case "L":
      return "qwen/qwen3-4b";
    case "XL":
      return "qwen/qwen3-32b";
  }
}
