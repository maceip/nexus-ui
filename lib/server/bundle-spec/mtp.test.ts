import { describe, it, expect } from "vitest";

import {
  buildPrompt,
  USER_DELIM_CLOSE,
  USER_DELIM_OPEN,
  TOOL_DELIM_CLOSE,
  TOOL_DELIM_OPEN,
} from "@/lib/server/bundle-spec/mtp";
import { generateBundleSpec } from "@/lib/server/bundle-spec/service";

describe("buildPrompt (MTP v1)", () => {
  const spec = generateBundleSpec({
    userRequest: "x",
    llmResponse: "y",
    bundleTier: "M",
  });

  it("returns exactly two messages: system then user", () => {
    const out = buildPrompt(spec, {
      roleId: "orchestrator",
      sessionId: "s1",
      userTurn: "hello",
    });
    expect(out).toHaveLength(2);
    expect(out[0].role).toBe("system");
    expect(out[1].role).toBe("user");
  });

  it("concatenates prefix layers in declared order, byte-exact", () => {
    const out = buildPrompt(spec, {
      roleId: "orchestrator",
      sessionId: "s1",
      userTurn: "hello",
    });
    const layerIds = spec.manifest.roles.find(
      (r) => r.id === "orchestrator",
    )!.prefix_layer_ids;
    const expected = layerIds.map((id) => spec.prefixes[id]).join("");
    expect(out[0].content).toBe(expected);
  });

  it("frames the user turn with stable delimiters", () => {
    const out = buildPrompt(spec, {
      roleId: "orchestrator",
      sessionId: "s1",
      userTurn: "Find invoices from last quarter.",
    });
    const expected = `${USER_DELIM_OPEN}Find invoices from last quarter.${USER_DELIM_CLOSE}`;
    expect(out[1].content).toBe(expected);
  });

  it("frames tool results before the user turn", () => {
    const out = buildPrompt(spec, {
      roleId: "executor",
      sessionId: "s2",
      userTurn: "done?",
      toolResults: [
        { role: "executor", text: "tool_output_1" },
        { role: "executor", text: "tool_output_2" },
      ],
    });
    const expected = [
      `${TOOL_DELIM_OPEN}role=executor\ntool_output_1${TOOL_DELIM_CLOSE}`,
      `${TOOL_DELIM_OPEN}role=executor\ntool_output_2${TOOL_DELIM_CLOSE}`,
      `${USER_DELIM_OPEN}done?${USER_DELIM_CLOSE}`,
    ].join("\n");
    expect(out[1].content).toBe(expected);
  });

  it("is byte-stable across repeated calls (prefix caching invariant)", () => {
    const first = buildPrompt(spec, {
      roleId: "orchestrator",
      sessionId: "s1",
      userTurn: "Quarterly summary please",
    });
    const second = buildPrompt(spec, {
      roleId: "orchestrator",
      sessionId: "s1",
      userTurn: "Quarterly summary please",
    });
    expect(second).toEqual(first);
    expect(second[0].content).toBe(first[0].content);
    expect(second[1].content).toBe(first[1].content);
  });

  it("normalizes Unicode to NFC", () => {
    const decomposed = "é"; // precomposed é
    const composedForm = "é"; // e + combining acute
    const outA = buildPrompt(spec, {
      roleId: "orchestrator",
      sessionId: "s1",
      userTurn: decomposed,
    });
    const outB = buildPrompt(spec, {
      roleId: "orchestrator",
      sessionId: "s1",
      userTurn: composedForm,
    });
    expect(outB[1].content).toBe(outA[1].content);
  });

  it("throws on unknown role_id", () => {
    expect(() =>
      buildPrompt(spec, {
        roleId: "ghost",
        sessionId: "s1",
        userTurn: "hi",
      }),
    ).toThrow(/Unknown role_id/);
  });

  it("throws on missing prefix layer", () => {
    const broken = {
      ...spec,
      prefixes: { global: spec.prefixes.global },
    };
    expect(() =>
      buildPrompt(broken, {
        roleId: "orchestrator",
        sessionId: "s1",
        userTurn: "hi",
      }),
    ).toThrow(/Missing prefix layer/);
  });

  it("throws when serialization_mode is not chat_messages", () => {
    const broken = {
      ...spec,
      manifest: {
        ...spec.manifest,
        mtp: { ...spec.manifest.mtp, serialization_mode: "raw_string" as "chat_messages" },
      },
    };
    expect(() =>
      buildPrompt(broken, {
        roleId: "orchestrator",
        sessionId: "s1",
        userTurn: "hi",
      }),
    ).toThrow(/chat_messages/);
  });
});
