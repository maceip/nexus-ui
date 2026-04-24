import { describe, it, expect } from "vitest";

import {
  bundleManifestSchema,
  bundleSpecSchema,
  memorySchema,
  profileIdMatchesTier,
} from "@/lib/server/bundle-spec/schema";
import { generateBundleSpec } from "@/lib/server/bundle-spec/service";

describe("memorySchema", () => {
  it("rejects unknown keys (closed key set)", () => {
    const result = memorySchema.safeParse({
      device_class: "cpu",
      host_ram_min_bytes: 1_000_000,
      min_vram_bytes: 0,
      gpu_memory_utilization_cap: 0,
      max_concurrent_requests: 1,
      cpu_offload_policy: "none",
      download_chunk_mb: 8,
      apc_priority_roles: [],
      future_field: "nope",
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-zero min_vram_bytes when device_class is cpu", () => {
    const result = memorySchema.safeParse({
      device_class: "cpu",
      host_ram_min_bytes: 1_000_000,
      min_vram_bytes: 1,
      gpu_memory_utilization_cap: 0,
      max_concurrent_requests: 1,
      cpu_offload_policy: "none",
      download_chunk_mb: 8,
      apc_priority_roles: [],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join("."));
      expect(paths).toContain("min_vram_bytes");
    }
  });

  it("rejects non-zero gpu_memory_utilization_cap when device_class is cpu", () => {
    const result = memorySchema.safeParse({
      device_class: "cpu",
      host_ram_min_bytes: 1_000_000,
      min_vram_bytes: 0,
      gpu_memory_utilization_cap: 0.5,
      max_concurrent_requests: 1,
      cpu_offload_policy: "none",
      download_chunk_mb: 8,
      apc_priority_roles: [],
    });
    expect(result.success).toBe(false);
  });

  it("requires min_vram_bytes > 0 when device_class is gpu or metal", () => {
    const result = memorySchema.safeParse({
      device_class: "metal",
      host_ram_min_bytes: 1_000_000,
      min_vram_bytes: 0,
      gpu_memory_utilization_cap: 0.75,
      max_concurrent_requests: 1,
      cpu_offload_policy: "none",
      download_chunk_mb: 8,
      apc_priority_roles: [],
    });
    expect(result.success).toBe(false);
  });

  it("requires gpu_memory_utilization_cap in (0, 1]", () => {
    const result = memorySchema.safeParse({
      device_class: "gpu",
      host_ram_min_bytes: 1_000_000,
      min_vram_bytes: 1_000_000,
      gpu_memory_utilization_cap: 1.5,
      max_concurrent_requests: 1,
      cpu_offload_policy: "none",
      download_chunk_mb: 8,
      apc_priority_roles: [],
    });
    expect(result.success).toBe(false);
  });

  it("accepts a valid metal configuration", () => {
    const result = memorySchema.safeParse({
      device_class: "metal",
      host_ram_min_bytes: 8 * 1_073_741_824,
      min_vram_bytes: 8 * 1_073_741_824,
      gpu_memory_utilization_cap: 0.75,
      max_concurrent_requests: 2,
      cpu_offload_policy: "none",
      download_chunk_mb: 16,
      apc_priority_roles: ["orchestrator"],
    });
    expect(result.success).toBe(true);
  });
});

describe("bundleManifestSchema — tier/suffix rule", () => {
  it("rejects profile_id whose suffix does not match bundle_tier", () => {
    const base = generateBundleSpec({
      userRequest: "x",
      llmResponse: "y",
      bundleTier: "M",
    });
    const bad = {
      ...base.manifest,
      distribution: {
        ...base.manifest.distribution,
        profile_id: "macos-metal-L",
      },
    };
    const result = bundleManifestSchema.safeParse(bad);
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join("."));
      expect(paths).toContain("distribution.profile_id");
    }
  });

  it("accepts profile_id 'draft' for any tier (authoring-only)", () => {
    const base = generateBundleSpec({
      userRequest: "x",
      llmResponse: "y",
      bundleTier: "L",
    });
    const result = bundleManifestSchema.safeParse(base.manifest);
    expect(result.success).toBe(true);
  });

  it("accepts profile_id whose suffix matches bundle_tier", () => {
    const base = generateBundleSpec({
      userRequest: "x",
      llmResponse: "y",
      bundleTier: "M",
    });
    const good = {
      ...base.manifest,
      distribution: {
        ...base.manifest.distribution,
        profile_id: "macos-metal-M",
      },
    };
    const result = bundleManifestSchema.safeParse(good);
    expect(result.success).toBe(true);
  });

  it("rejects absolute paths in model fields", () => {
    const base = generateBundleSpec({
      userRequest: "x",
      llmResponse: "y",
      bundleTier: "M",
    });
    const bad = {
      ...base.manifest,
      model: { ...base.manifest.model, weights_relative_path: "/var/models/w" },
    };
    const result = bundleManifestSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it("rejects `..` path segments", () => {
    const base = generateBundleSpec({
      userRequest: "x",
      llmResponse: "y",
      bundleTier: "M",
    });
    const bad = {
      ...base.manifest,
      model: {
        ...base.manifest.model,
        tokenizer_relative_path: "models/../../etc/passwd",
      },
    };
    const result = bundleManifestSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it("rejects mtp.serialization_mode other than chat_messages", () => {
    const base = generateBundleSpec({
      userRequest: "x",
      llmResponse: "y",
      bundleTier: "M",
    });
    const bad = {
      ...base.manifest,
      mtp: { ...base.manifest.mtp, serialization_mode: "raw_string" },
    };
    const result = bundleManifestSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });
});

describe("bundleSpecSchema", () => {
  it("parses the output of generateBundleSpec for every tier", () => {
    for (const tier of ["S", "M", "L", "XL"] as const) {
      const spec = generateBundleSpec({
        userRequest: "x",
        llmResponse: "y",
        bundleTier: tier,
      });
      const result = bundleSpecSchema.safeParse(spec);
      expect(result.success, `tier ${tier} should parse`).toBe(true);
    }
  });
});

describe("profileIdMatchesTier", () => {
  it.each([
    ["macos-metal-S", "S", true],
    ["macos-metal-M", "M", true],
    ["windows-cuda-L", "L", true],
    ["linux-cpu-XL", "XL", true],
    ["macos-metal-M", "L", false],
    ["draft", "S", true],
    ["draft", "XL", true],
  ])("%s for tier %s → %s", (id, tier, expected) => {
    expect(profileIdMatchesTier(id, tier as "S" | "M" | "L" | "XL")).toBe(expected);
  });
});
