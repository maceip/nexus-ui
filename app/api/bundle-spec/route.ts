import { NextResponse } from "next/server";

import { bundleSpecInputSchema } from "@/lib/server/bundle-spec/input-schema";
import { generateBundleSpec } from "@/lib/server/bundle-spec/service";
import { emitBundleArtifacts } from "@/lib/server/bundle-spec/yaml";
import {
  apiError,
  DEFAULT_MAX_BODY_BYTES,
  DEFAULT_WALL_TIMEOUT_MS,
  logRequest,
  parseJsonBodyWithLimit,
  resolveRequestId,
  withWallTimeout,
  zodValidationDetails,
} from "@/lib/server/http/errors";

const ROUTE = "POST /api/bundle-spec";

export async function POST(req: Request) {
  const requestId = resolveRequestId(req);
  const startedAt = Date.now();

  const body = await parseJsonBodyWithLimit(req, DEFAULT_MAX_BODY_BYTES);
  if (!body.ok) {
    if (body.kind === "too_large") {
      logRequest({
        requestId,
        route: ROUTE,
        status: 413,
        durationMs: Date.now() - startedAt,
        code: "PAYLOAD_TOO_LARGE",
      });
      return apiError(
        "PAYLOAD_TOO_LARGE",
        `Request body exceeds ${body.limitBytes} bytes.`,
        requestId,
        { limitBytes: body.limitBytes },
      );
    }
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

  const parsed = bundleSpecInputSchema.safeParse(body.data);
  if (!parsed.success) {
    logRequest({
      requestId,
      route: ROUTE,
      status: 400,
      durationMs: Date.now() - startedAt,
      code: "BUNDLE_SPEC_VALIDATION",
    });
    return apiError(
      "BUNDLE_SPEC_VALIDATION",
      "Invalid bundle spec input.",
      requestId,
      zodValidationDetails(parsed.error),
    );
  }

  const timed = await withWallTimeout(async () => {
    const spec = generateBundleSpec(parsed.data);
    const artifacts = emitBundleArtifacts(spec);
    return { spec, artifacts };
  }, DEFAULT_WALL_TIMEOUT_MS);

  if (!timed.ok) {
    logRequest({
      requestId,
      route: ROUTE,
      status: 504,
      durationMs: Date.now() - startedAt,
      code: "REQUEST_TIMEOUT",
    });
    return apiError(
      "REQUEST_TIMEOUT",
      `Bundle spec generation exceeded ${DEFAULT_WALL_TIMEOUT_MS} ms.`,
      requestId,
      { timeoutMs: DEFAULT_WALL_TIMEOUT_MS },
    );
  }

  try {
    logRequest({
      requestId,
      route: ROUTE,
      status: 200,
      durationMs: Date.now() - startedAt,
    });
    return NextResponse.json(
      {
        bundleTier: timed.value.spec.bundle_tier,
        spec: timed.value.spec,
        artifacts: timed.value.artifacts,
      },
      { headers: { "x-request-id": requestId } },
    );
  } catch (error) {
    logRequest({
      requestId,
      route: ROUTE,
      status: 422,
      durationMs: Date.now() - startedAt,
      code: "BUNDLE_SPEC_GENERATION_FAILED",
    });
    return apiError(
      "BUNDLE_SPEC_GENERATION_FAILED",
      "Failed to generate bundle spec.",
      requestId,
      { reason: error instanceof Error ? error.message : "Unknown error" },
    );
  }
}
