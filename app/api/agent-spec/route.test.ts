import { describe, it, expect } from "vitest";

import { POST } from "@/app/api/agent-spec/route";
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
  return new Request("http://localhost/api/agent-spec", init);
}

describe("POST /api/agent-spec", () => {
  it("returns 400 INVALID_JSON when the body is not valid JSON", async () => {
    const res = await POST(makeRequest("this is not json"));
    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorBody;
    expect(body.error.code).toBe("INVALID_JSON");
    expect(body.error.requestId).toBeTruthy();
    expect(res.headers.get("x-request-id")).toBe(body.error.requestId);
  });

  it("returns 400 AGENT_SPEC_VALIDATION when required fields are missing", async () => {
    const res = await POST(makeRequest(JSON.stringify({ userRequest: "" })));
    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorBody;
    expect(body.error.code).toBe("AGENT_SPEC_VALIDATION");
    expect(body.error.details).toBeDefined();
  });

  it("echoes an incoming x-request-id header", async () => {
    const res = await POST(
      makeRequest("{", { "x-request-id": "req-test-123" }),
    );
    const body = (await res.json()) as ApiErrorBody;
    expect(body.error.requestId).toBe("req-test-123");
    expect(res.headers.get("x-request-id")).toBe("req-test-123");
  });

  it("returns a normalized spec for a valid body", async () => {
    const res = await POST(
      makeRequest(
        JSON.stringify({
          userRequest:
            "Build an agent that reads my email for one-time passwords and forwards them to SMS.",
          llmResponse:
            "Use IMAP polling at a steady interval and send OTPs via Twilio. huggingface.co/google/gemma-3-4b",
          contexts: {
            github: "acme/otp-agent",
            huggingface: "google/gemma-3-4b",
          },
        }),
      ),
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      spec: { schema_version: string };
      yaml: string;
      responseContractYaml: string;
      executableValidation: { executable: string };
    };
    expect(json.spec.schema_version).toBe("1.2");
    expect(typeof json.yaml).toBe("string");
    expect(json.yaml.length).toBeGreaterThan(0);
    expect(json.executableValidation.executable).toBe("agent.exe");
    expect(res.headers.get("x-request-id")).toBeTruthy();
  });

  it("never throws for random JSON input (fuzz)", async () => {
    const samples: unknown[] = [
      null,
      {},
      [],
      { userRequest: 12, llmResponse: true },
      { userRequest: "x".repeat(40_000), llmResponse: "y" },
      { userRequest: "ok", llmResponse: "ok", contexts: { github: "" } },
      { userRequest: "ok", llmResponse: "ok", contexts: "bad" },
    ];
    for (const sample of samples) {
      const res = await POST(makeRequest(JSON.stringify(sample)));
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
      const body = (await res.json()) as ApiErrorBody;
      expect(body.error.requestId).toBeTruthy();
      expect(body.error.code).toBeDefined();
    }
  });
});
