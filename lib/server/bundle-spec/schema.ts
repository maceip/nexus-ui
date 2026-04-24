import { z } from "zod";

export const BUNDLE_TIERS = ["S", "M", "L", "XL"] as const;
export const bundleTierSchema = z.enum(BUNDLE_TIERS);
export type BundleTier = z.infer<typeof bundleTierSchema>;

const DEVICE_CLASSES = ["cpu", "gpu", "metal"] as const;
export const deviceClassSchema = z.enum(DEVICE_CLASSES);
export type DeviceClass = z.infer<typeof deviceClassSchema>;

const DRAFT_PROFILE_ID = "draft" as const;
export { DRAFT_PROFILE_ID };

const relativePathSchema = z
  .string()
  .min(1)
  .refine((p) => !p.startsWith("/") && !/^[a-zA-Z]:[\\/]/.test(p), {
    message: "Path must be relative to install root (no leading / or drive letter).",
  })
  .refine((p) => !p.split(/[\\/]/).some((seg) => seg === ".."), {
    message: "Path must not contain `..` segments.",
  });

const httpsUrlSchema = z
  .string()
  .url()
  .refine((u) => u.startsWith("https://"), { message: "URL must use https://" });

const semverSchema = z
  .string()
  .regex(/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/, {
    message: "Expected semver (x.y.z).",
  });

const PROFILE_ID_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*-(?:S|M|L|XL)$/;

export const distributionSchema = z.object({
  profile_id: z.union([
    z.literal(DRAFT_PROFILE_ID),
    z.string().regex(PROFILE_ID_PATTERN, {
      message:
        "profile_id must be lowercase kebab-case with a trailing tier suffix (e.g. macos-metal-M).",
    }),
  ]),
  bundle_tier: bundleTierSchema,
  stage2_archive_format: z.literal("tar.zst"),
  dropper_min_version: semverSchema,
  channel_url: httpsUrlSchema,
});

export type Distribution = z.infer<typeof distributionSchema>;

export const mtpSchema = z.object({
  policy_id: z.string().min(1),
  serialization_mode: z.literal("chat_messages"),
});

export const vllmLaunchSchema = z.object({
  package_version: semverSchema,
  enable_prefix_caching: z.literal(true),
  launch: z.array(z.string().min(1)).min(1),
});

export const modelSpecSchema = z.object({
  id: z.string().min(1),
  revision: z.string().min(1),
  weights_relative_path: relativePathSchema,
  tokenizer_relative_path: relativePathSchema,
});

const MEMORY_KEYS = [
  "device_class",
  "host_ram_min_bytes",
  "min_vram_bytes",
  "gpu_memory_utilization_cap",
  "max_concurrent_requests",
  "cpu_offload_policy",
  "prefix_cache_budget_tokens",
  "download_chunk_mb",
  "apc_priority_roles",
  "idle_release_policy",
  "disk_spill_dir",
] as const;
export { MEMORY_KEYS };

const memoryBaseSchema = z
  .object({
    device_class: deviceClassSchema,
    host_ram_min_bytes: z.number().int().positive(),
    min_vram_bytes: z.number().int().nonnegative(),
    gpu_memory_utilization_cap: z.number().min(0).max(1),
    max_concurrent_requests: z.number().int().positive(),
    cpu_offload_policy: z.enum(["none", "weights", "kv"]).default("none"),
    prefix_cache_budget_tokens: z.number().int().positive().optional(),
    download_chunk_mb: z.number().int().positive(),
    apc_priority_roles: z.array(z.string().min(1)).default([]),
    idle_release_policy: z.string().min(1).optional(),
    disk_spill_dir: z.string().min(1).optional(),
  })
  .strict();

export const memorySchema = memoryBaseSchema.superRefine((mem, ctx) => {
  if (mem.device_class === "cpu") {
    if (mem.min_vram_bytes !== 0) {
      ctx.addIssue({
        code: "custom",
        path: ["min_vram_bytes"],
        message: "min_vram_bytes must be 0 when device_class is cpu.",
      });
    }
    if (mem.gpu_memory_utilization_cap !== 0) {
      ctx.addIssue({
        code: "custom",
        path: ["gpu_memory_utilization_cap"],
        message: "gpu_memory_utilization_cap must be 0 when device_class is cpu.",
      });
    }
    if (mem.cpu_offload_policy !== "none") {
      ctx.addIssue({
        code: "custom",
        path: ["cpu_offload_policy"],
        message: "cpu_offload_policy must be \"none\" when device_class is cpu.",
      });
    }
  } else {
    if (mem.min_vram_bytes <= 0) {
      ctx.addIssue({
        code: "custom",
        path: ["min_vram_bytes"],
        message: "min_vram_bytes must be > 0 when device_class is gpu or metal.",
      });
    }
    if (!(mem.gpu_memory_utilization_cap > 0 && mem.gpu_memory_utilization_cap <= 1)) {
      ctx.addIssue({
        code: "custom",
        path: ["gpu_memory_utilization_cap"],
        message:
          "gpu_memory_utilization_cap must be within (0, 1] when device_class is gpu or metal.",
      });
    }
  }
});

export type Memory = z.infer<typeof memorySchema>;

export const roleRefSchema = z.object({
  id: z.string().min(1),
  definition_relative_path: relativePathSchema,
  prefix_layer_ids: z.array(z.string().min(1)).min(1),
});

export const bundleManifestSchema = z
  .object({
    bundle_schema_version: semverSchema,
    distribution: distributionSchema,
    vllm: vllmLaunchSchema,
    model: modelSpecSchema,
    memory: memorySchema,
    mtp: mtpSchema,
    roles: z.array(roleRefSchema).min(1),
    logging: z
      .object({
        max_mb: z.number().int().positive(),
      })
      .optional(),
    updates: z
      .object({
        channel_url: httpsUrlSchema,
      })
      .optional(),
  })
  .superRefine((manifest, ctx) => {
    const tier = manifest.distribution.bundle_tier;
    const profileId = manifest.distribution.profile_id;
    if (profileId !== DRAFT_PROFILE_ID) {
      if (!profileId.endsWith(`-${tier}`)) {
        ctx.addIssue({
          code: "custom",
          path: ["distribution", "profile_id"],
          message: `profile_id must end with "-${tier}" to match bundle_tier.`,
        });
      }
    }
  });

export type BundleManifest = z.infer<typeof bundleManifestSchema>;

export const roleSamplingSchema = z.object({
  temperature: z.number().min(0).max(2),
  max_prompt_tokens: z.number().int().positive(),
  max_total_tokens: z.number().int().positive(),
});

export const roleDefinitionSchema = z.object({
  role_id: z.string().min(1),
  sampling: roleSamplingSchema,
  tools_allowlist: z
    .array(
      z.object({
        id: z.string().min(1),
        argv_template: z.array(z.string().min(1)).min(1),
      }),
    )
    .default([]),
  mtp: z
    .object({
      suffix_template_relative_path: relativePathSchema,
    })
    .optional(),
});

export type RoleDefinition = z.infer<typeof roleDefinitionSchema>;

export const bundleSpecSchema = z.object({
  spec_version: z.literal("1.0"),
  bundle_tier: bundleTierSchema,
  manifest: bundleManifestSchema,
  roles: z.array(roleDefinitionSchema).min(1),
  prefixes: z
    .record(
      z.string().regex(/^[a-z][a-z0-9_]*$/),
      z.string(),
    )
    .refine((p) => Object.keys(p).length > 0, {
      message: "At least one prefix layer must be declared.",
    }),
});

export type BundleSpec = z.infer<typeof bundleSpecSchema>;

export function profileIdMatchesTier(profileId: string, tier: BundleTier): boolean {
  if (profileId === DRAFT_PROFILE_ID) return true;
  return profileId.endsWith(`-${tier}`);
}
