import "server-only";

import { NextResponse } from "next/server";
import { z } from "zod";

export type ApiErrorCode =
  | "INVALID_JSON"
  | "AGENT_SPEC_VALIDATION"
  | "AGENT_SPEC_GENERATION_FAILED"
  | "INTERNAL_ERROR";

export type ApiErrorBody = {
  error: {
    code: ApiErrorCode;
    message: string;
    details?: unknown;
    requestId: string;
  };
};

const STATUS_BY_CODE: Record<ApiErrorCode, number> = {
  INVALID_JSON: 400,
  AGENT_SPEC_VALIDATION: 400,
  AGENT_SPEC_GENERATION_FAILED: 422,
  INTERNAL_ERROR: 500,
};

export function resolveRequestId(req: Request): string {
  const header = req.headers.get("x-request-id");
  if (header && header.length > 0 && header.length <= 200) {
    return header;
  }
  return crypto.randomUUID();
}

export function apiError(
  code: ApiErrorCode,
  message: string,
  requestId: string,
  details?: unknown,
): NextResponse<ApiErrorBody> {
  const body: ApiErrorBody = {
    error: { code, message, requestId, ...(details !== undefined ? { details } : {}) },
  };
  return NextResponse.json(body, {
    status: STATUS_BY_CODE[code],
    headers: { "x-request-id": requestId },
  });
}

export async function parseJsonBody(req: Request): Promise<
  { ok: true; data: unknown } | { ok: false; message: string }
> {
  try {
    const data = await req.json();
    return { ok: true, data };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Malformed JSON body",
    };
  }
}

export function zodValidationDetails(error: z.ZodError): unknown {
  return error.flatten();
}

export function logRequest(entry: {
  requestId: string;
  route: string;
  status: number;
  durationMs: number;
  code?: ApiErrorCode;
  tenantId?: string;
}): void {
  const line = JSON.stringify({ ...entry, ts: new Date().toISOString() });
  if (entry.status >= 500) {
    console.error(line);
  } else {
    console.log(line);
  }
}
