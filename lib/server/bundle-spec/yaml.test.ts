import { describe, it, expect } from "vitest";
import YAML from "yaml";

import {
  emitBundleArtifacts,
  toManifestJson,
  toRoleYaml,
} from "@/lib/server/bundle-spec/yaml";
import { generateBundleSpec } from "@/lib/server/bundle-spec/service";
import {
  bundleManifestSchema,
  roleDefinitionSchema,
} from "@/lib/server/bundle-spec/schema";

describe("manifest JSON emit", () => {
  it("round-trips through JSON.parse equal to the source manifest", () => {
    const spec = generateBundleSpec({
      userRequest: "x",
      llmResponse: "y",
      bundleTier: "M",
    });
    const json = toManifestJson(spec.manifest);
    const parsed = JSON.parse(json);
    expect(parsed).toEqual(spec.manifest);
    expect(bundleManifestSchema.safeParse(parsed).success).toBe(true);
  });
});

describe("role YAML emit", () => {
  it("round-trips through YAML.parse preserving fields", () => {
    const spec = generateBundleSpec({
      userRequest: "x",
      llmResponse: "y",
      bundleTier: "M",
    });
    for (const role of spec.roles) {
      const yaml = toRoleYaml(role);
      const parsed = YAML.parse(yaml);
      expect(roleDefinitionSchema.safeParse(parsed).success).toBe(true);
      expect(parsed.role_id).toBe(role.role_id);
      expect(parsed.sampling).toEqual(role.sampling);
    }
  });

  it("matches a stable inline snapshot for the orchestrator role (M tier)", () => {
    const spec = generateBundleSpec({
      userRequest: "x",
      llmResponse: "y",
      bundleTier: "M",
    });
    const orchestrator = spec.roles.find((r) => r.role_id === "orchestrator")!;
    const yaml = toRoleYaml(orchestrator);
    expect(yaml).toMatchInlineSnapshot(`
      "role_id: "orchestrator"
      sampling:
        temperature: 0
        max_prompt_tokens: 8192
        max_total_tokens: 12288
      tools_allowlist: []
      mtp:
        suffix_template_relative_path: "prefixes/orchestrator_suffix.txt"
      "
    `);
  });
});

describe("emitBundleArtifacts", () => {
  it("emits manifest.json + role YAML files + prefix txt files", () => {
    const spec = generateBundleSpec({
      userRequest: "x",
      llmResponse: "y",
      bundleTier: "M",
    });
    const artifacts = emitBundleArtifacts(spec);
    expect(artifacts.manifestJson.startsWith("{")).toBe(true);
    expect(artifacts.roleFiles.map((f) => f.path)).toEqual([
      "roles/orchestrator.yaml",
      "roles/executor.yaml",
    ]);
    const prefixPaths = artifacts.prefixFiles.map((f) => f.path).sort();
    expect(prefixPaths).toEqual([
      "prefixes/executor_header.txt",
      "prefixes/global.txt",
      "prefixes/orchestrator_header.txt",
    ]);
  });
});
