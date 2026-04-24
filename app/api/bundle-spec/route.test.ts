import { describe, it, expect } from "vitest";

import { POST } from "@/app/api/bundle-spec/route";
import type { ApiErrorBody } from "@/lib/server/http/errors";

function makeRequest(
  body: string | undefined,
  headers: Record<string, string> = {},
): Request {
  const init: RequestInit = {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...headers,
    },
  };
  if (body !== undefined) {
    init.body = body;
  }
  return new Request("http://localhost/api/bundle-spec", init);
}

describe("POST /api/bundle-spec", () => {
  it("returns 400 INVALID_JSON for a non-JSON body", async () => {
    const res = await POST(makeRequest("not json at all"));
    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorBody;
    expect(body.error.code).toBe("INVALID_JSON");
    expect(res.headers.get("x-request-id")).toBe(body.error.requestId);
  });

  it("returns 400 BUNDLE_SPEC_VALIDATION on invalid shape", async () => {
    const res = await POST(
      makeRequest(JSON.stringify({ userRequest: "", bundleTier: "ZZ" })),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorBody;
    expect(body.error.code).toBe("BUNDLE_SPEC_VALIDATION");
    expect(body.error.details).toBeDefined();
  });

  it("returns 413 PAYLOAD_TOO_LARGE when content-length exceeds 512 KiB", async () => {
    const big = "a".repeat(10);
    const req = new Request("http://localhost/api/bundle-spec", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "content-length": String(1024 * 1024),
      },
      body: big,
    });
    const res = await POST(req);
    expect(res.status).toBe(413);
    const body = (await res.json()) as ApiErrorBody;
    expect(body.error.code).toBe("PAYLOAD_TOO_LARGE");
  });

  it("returns 413 PAYLOAD_TOO_LARGE when streamed body exceeds 512 KiB (no content-length)", async () => {
    const big = "x".repeat(600 * 1024);
    const req = new Request("http://localhost/api/bundle-spec", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: big,
    });
    const res = await POST(req);
    expect(res.status).toBe(413);
  });

  it("echoes incoming x-request-id header", async () => {
    const res = await POST(
      makeRequest("{", { "x-request-id": "req-bundle-42" }),
    );
    const body = (await res.json()) as ApiErrorBody;
    expect(body.error.requestId).toBe("req-bundle-42");
    expect(res.headers.get("x-request-id")).toBe("req-bundle-42");
  });

  it("returns a draft bundle spec for a valid body (default tier M)", async () => {
    const res = await POST(
      makeRequest(
        JSON.stringify({
          userRequest: "Build an agent that summarizes invoices locally.",
          llmResponse:
            "Use huggingface.co/google/gemma-3-4b revision:main for a first pilot.",
        }),
      ),
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      bundleTier: string;
      spec: {
        bundle_tier: string;
        manifest: {
          distribution: { bundle_tier: string; profile_id: string };
          mtp: { serialization_mode: string };
        };
      };
      artifacts: {
        manifestJson: string;
        roleFiles: Array<{ path: string; yaml: string }>;
        prefixFiles: Array<{ path: string; content: string }>;
      };
    };
    expect(json.bundleTier).toBe("M");
    expect(json.spec.manifest.distribution.bundle_tier).toBe("M");
    expect(json.spec.manifest.distribution.profile_id).toBe("draft");
    expect(json.spec.manifest.mtp.serialization_mode).toBe("chat_messages");
    expect(json.artifacts.roleFiles.length).toBeGreaterThan(0);
    expect(json.artifacts.prefixFiles.length).toBeGreaterThan(0);
    expect(res.headers.get("x-request-id")).toBeTruthy();
  });

  it("honors an explicit bundleTier (S)", async () => {
    const res = await POST(
      makeRequest(
        JSON.stringify({
          userRequest: "Small footprint agent.",
          llmResponse: "Use CPU only.",
          bundleTier: "S",
        }),
      ),
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      bundleTier: string;
      spec: { manifest: { memory: { device_class: string } } };
    };
    expect(json.bundleTier).toBe("S");
    expect(json.spec.manifest.memory.device_class).toBe("cpu");
  });
});
