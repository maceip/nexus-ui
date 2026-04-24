import type { BundleSpec } from "@/lib/server/bundle-spec/schema";

export const USER_DELIM_OPEN = "<<<USER>>>\n";
export const USER_DELIM_CLOSE = "\n<<<END_USER>>>";

export const TOOL_DELIM_OPEN = "<<<TOOL_RESULT>>>\n";
export const TOOL_DELIM_CLOSE = "\n<<<END_TOOL_RESULT>>>";

export type ToolResult = { role: string; text: string };

export type BuildPromptInput = {
  roleId: string;
  sessionId: string;
  userTurn: string;
  toolResults?: ToolResult[];
};

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export type BuildPromptOutput = ChatMessage[];

function getRoleLayerIds(spec: BundleSpec, roleId: string): string[] {
  const roleRef = spec.manifest.roles.find((r) => r.id === roleId);
  if (!roleRef) {
    throw new Error(`Unknown role_id: ${roleId}`);
  }
  return roleRef.prefix_layer_ids;
}

function assembleSystemContent(spec: BundleSpec, layerIds: string[]): string {
  const parts: string[] = [];
  for (const layerId of layerIds) {
    const layer = spec.prefixes[layerId];
    if (layer == null) {
      throw new Error(`Missing prefix layer: ${layerId}`);
    }
    parts.push(layer);
  }
  return parts.join("");
}

function assembleUserContent(userTurn: string, toolResults: ToolResult[]): string {
  const segments: string[] = [];
  for (const tr of toolResults) {
    segments.push(`${TOOL_DELIM_OPEN}role=${tr.role}\n${tr.text}${TOOL_DELIM_CLOSE}`);
  }
  segments.push(`${USER_DELIM_OPEN}${userTurn}${USER_DELIM_CLOSE}`);
  return segments.join("\n");
}

export function buildPrompt(
  spec: BundleSpec,
  input: BuildPromptInput,
): BuildPromptOutput {
  if (spec.manifest.mtp.serialization_mode !== "chat_messages") {
    throw new Error(
      `Unsupported serialization_mode: ${spec.manifest.mtp.serialization_mode}. v1 supports chat_messages only.`,
    );
  }

  const layerIds = getRoleLayerIds(spec, input.roleId);
  const system = assembleSystemContent(spec, layerIds).normalize("NFC");
  const user = assembleUserContent(
    input.userTurn.normalize("NFC"),
    (input.toolResults ?? []).map((t) => ({
      role: t.role,
      text: t.text.normalize("NFC"),
    })),
  );

  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}
