import { describe, it, expect } from "vitest";

import { generateBundleSpec } from "@/lib/server/bundle-spec/service";
import {
  bundleSpecSchema,
  BUNDLE_TIERS,
  DRAFT_PROFILE_ID,
} from "@/lib/server/bundle-spec/schema";

describe("tier draft smoke (S / M / L / XL)", () => {
  it.each(BUNDLE_TIERS)("tier %s produces a valid draft spec", (tier) => {
    const spec = generateBundleSpec({
      userRequest: "Build a local agent.",
      llmResponse: "Use huggingface.co/org/model for pilot.",
      bundleTier: tier,
    });

    expect(bundleSpecSchema.safeParse(spec).success).toBe(true);
    expect(spec.bundle_tier).toBe(tier);
    expect(spec.manifest.distribution.bundle_tier).toBe(tier);
    expect(spec.manifest.distribution.profile_id).toBe(DRAFT_PROFILE_ID);
    expect(spec.manifest.mtp.serialization_mode).toBe("chat_messages");
    expect(spec.manifest.vllm.enable_prefix_caching).toBe(true);
  });

  it("tier S uses cpu device class with zero VRAM", () => {
    const spec = generateBundleSpec({
      userRequest: "x",
      llmResponse: "y",
      bundleTier: "S",
    });
    expect(spec.manifest.memory.device_class).toBe("cpu");
    expect(spec.manifest.memory.min_vram_bytes).toBe(0);
    expect(spec.manifest.memory.gpu_memory_utilization_cap).toBe(0);
  });

  it("tier XL uses gpu device class with non-zero VRAM floor", () => {
    const spec = generateBundleSpec({
      userRequest: "x",
      llmResponse: "y",
      bundleTier: "XL",
    });
    expect(spec.manifest.memory.device_class).toBe("gpu");
    expect(spec.manifest.memory.min_vram_bytes).toBeGreaterThan(0);
    expect(spec.manifest.memory.gpu_memory_utilization_cap).toBeGreaterThan(0);
  });

  it("tier memory floor scales monotonically S < M < L < XL", () => {
    const floors = BUNDLE_TIERS.map((tier) => {
      const spec = generateBundleSpec({
        userRequest: "x",
        llmResponse: "y",
        bundleTier: tier,
      });
      return spec.manifest.memory.host_ram_min_bytes;
    });
    for (let i = 1; i < floors.length; i++) {
      expect(floors[i]).toBeGreaterThan(floors[i - 1]);
    }
  });
});
