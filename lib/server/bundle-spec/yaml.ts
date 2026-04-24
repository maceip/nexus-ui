import YAML from "yaml";

import type {
  BundleManifest,
  BundleSpec,
  RoleDefinition,
} from "@/lib/server/bundle-spec/schema";

const YAML_OPTIONS = {
  lineWidth: 0,
  defaultStringType: "QUOTE_DOUBLE",
  defaultKeyType: "PLAIN",
} as const;

export function toManifestJson(manifest: BundleManifest): string {
  return JSON.stringify(manifest, null, 2) + "\n";
}

export function toRoleYaml(role: RoleDefinition): string {
  return YAML.stringify(role, null, YAML_OPTIONS);
}

export function toPrefixesFiles(prefixes: Record<string, string>): Array<{
  path: string;
  content: string;
}> {
  return Object.entries(prefixes).map(([id, content]) => ({
    path: `prefixes/${id}.txt`,
    content,
  }));
}

export type BundleArtifacts = {
  manifestJson: string;
  roleFiles: Array<{ path: string; yaml: string }>;
  prefixFiles: Array<{ path: string; content: string }>;
};

export function emitBundleArtifacts(spec: BundleSpec): BundleArtifacts {
  return {
    manifestJson: toManifestJson(spec.manifest),
    roleFiles: spec.roles.map((role) => ({
      path: `roles/${role.role_id}.yaml`,
      yaml: toRoleYaml(role),
    })),
    prefixFiles: toPrefixesFiles(spec.prefixes),
  };
}
