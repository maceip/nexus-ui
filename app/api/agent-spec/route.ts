import { NextResponse } from "next/server";

import { agentSpecInputSchema } from "@/lib/server/agent-spec/input-schema";
import { generateAgentSpec } from "@/lib/server/agent-spec/service";
import {
  apiError,
  logRequest,
  parseJsonBody,
  resolveRequestId,
  zodValidationDetails,
} from "@/lib/server/http/errors";

const ROUTE = "POST /api/agent-spec";

export async function POST(req: Request) {
  const requestId = resolveRequestId(req);
  const startedAt = Date.now();

  const body = await parseJsonBody(req);
  if (!body.ok) {
    logRequest({
      requestId,
      route: ROUTE,
      status: 400,
      durationMs: Date.now() - startedAt,
      code: "INVALID_JSON",
    });
    return apiError("INVALID_JSON", "Request body must be valid JSON.", requestId, {
      reason: body.message,
    });
  }

  const parsed = agentSpecInputSchema.safeParse(body.data);
  if (!parsed.success) {
    logRequest({
      requestId,
      route: ROUTE,
      status: 400,
      durationMs: Date.now() - startedAt,
      code: "AGENT_SPEC_VALIDATION",
    });
    return apiError(
      "AGENT_SPEC_VALIDATION",
      "Invalid agent spec input.",
      requestId,
      zodValidationDetails(parsed.error),
    );
  }

  try {
    const result = generateAgentSpec(parsed.data);
    logRequest({
      requestId,
      route: ROUTE,
      status: 200,
      durationMs: Date.now() - startedAt,
    });
    return NextResponse.json(result, {
      headers: { "x-request-id": requestId },
    });
  } catch (error) {
    logRequest({
      requestId,
      route: ROUTE,
      status: 500,
      durationMs: Date.now() - startedAt,
      code: "AGENT_SPEC_GENERATION_FAILED",
    });
    return apiError(
      "AGENT_SPEC_GENERATION_FAILED",
      "Failed to generate agent spec.",
      requestId,
      { reason: error instanceof Error ? error.message : "Unknown error" },
    );
  }
}
