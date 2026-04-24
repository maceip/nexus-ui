import "server-only";

import { NextResponse } from "next/server";
import { z } from "zod";

export type ApiErrorCode =
  | "INVALID_JSON"
  | "PAYLOAD_TOO_LARGE"
  | "REQUEST_TIMEOUT"
  | "BUNDLE_SPEC_VALIDATION"
  | "BUNDLE_SPEC_GENERATION_FAILED"
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
  PAYLOAD_TOO_LARGE: 413,
  REQUEST_TIMEOUT: 504,
  BUNDLE_SPEC_VALIDATION: 400,
  BUNDLE_SPEC_GENERATION_FAILED: 422,
  AGENT_SPEC_VALIDATION: 400,
  AGENT_SPEC_GENERATION_FAILED: 422,
  INTERNAL_ERROR: 500,
};

export const DEFAULT_MAX_BODY_BYTES = 512 * 1024;
export const DEFAULT_WALL_TIMEOUT_MS = 10_000;

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

export type ParseJsonResult =
  | { ok: true; data: unknown }
  | { ok: false; kind: "too_large"; limitBytes: number }
  | { ok: false; kind: "invalid_json"; message: string };

export async function parseJsonBodyWithLimit(
  req: Request,
  maxBytes: number = DEFAULT_MAX_BODY_BYTES,
): Promise<ParseJsonResult> {
  const contentLength = req.headers.get("content-length");
  if (contentLength != null) {
    const declared = Number(contentLength);
    if (Number.isFinite(declared) && declared > maxBytes) {
      return { ok: false, kind: "too_large", limitBytes: maxBytes };
    }
  }

  let text: string;
  try {
    const body = req.body;
    if (body == null) {
      text = await req.text();
    } else {
      const reader = body.getReader();
      const chunks: Uint8Array[] = [];
      let received = 0;
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) {
          received += value.byteLength;
          if (received > maxBytes) {
            try {
              await reader.cancel();
            } catch {
              /* noop */
            }
            return { ok: false, kind: "too_large", limitBytes: maxBytes };
          }
          chunks.push(value);
        }
      }
      text = new TextDecoder().decode(concatChunks(chunks, received));
    }
  } catch (error) {
    return {
      ok: false,
      kind: "invalid_json",
      message: error instanceof Error ? error.message : "Failed to read body",
    };
  }

  if (text.length === 0) {
    return { ok: false, kind: "invalid_json", message: "Empty body" };
  }

  try {
    return { ok: true, data: JSON.parse(text) };
  } catch (error) {
    return {
      ok: false,
      kind: "invalid_json",
      message: error instanceof Error ? error.message : "Malformed JSON",
    };
  }
}

function concatChunks(chunks: Uint8Array[], total: number): Uint8Array {
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

export function zodValidationDetails(error: z.ZodError): unknown {
  return error.flatten();
}

export async function withWallTimeout<T>(
  work: () => Promise<T>,
  timeoutMs: number = DEFAULT_WALL_TIMEOUT_MS,
): Promise<{ ok: true; value: T } | { ok: false; timedOut: true }> {
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<"__timeout__">((resolve) => {
    timeoutHandle = setTimeout(() => resolve("__timeout__"), timeoutMs);
  });

  try {
    const result = await Promise.race([work(), timeoutPromise]);
    if (result === "__timeout__") {
      return { ok: false, timedOut: true };
    }
    return { ok: true, value: result as T };
  } finally {
    if (timeoutHandle !== undefined) clearTimeout(timeoutHandle);
  }
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
