export type InstallTrackKind =
  | "registry-item-json"
  | "registry-source-file"
  | "api-registry-item-json"
  | "api-registry-source";

export type InstallTrackPayload = {
  kind: InstallTrackKind;
  /** Public path, e.g. /r/message.json or /registry/new-york/message/message.tsx */
  path: string;
  userAgent: string | null;
  /** @internal */
  at: string;
};

function isDisabled() {
  return process.env.NEXUS_INSTALL_TRACKING_DISABLED === "1";
}

/**
 * Fire-and-forget hook for shadcn / registry HTTP traffic.
 * - Logs one JSON line per request (grep Vercel logs for `[nexus-install]`).
 * - Optionally POSTs to NEXUS_INSTALL_WEBHOOK_URL (JSON body).
 */
export function recordInstallEvent(payload: Omit<InstallTrackPayload, "at">) {
  if (isDisabled()) return;

  const event: InstallTrackPayload = {
    ...payload,
    at: new Date().toISOString(),
  };

  console.log(`[nexus-install] ${JSON.stringify(event)}`);

  const url = process.env.NEXUS_INSTALL_WEBHOOK_URL;
  if (!url) return;

  const secret = process.env.NEXUS_INSTALL_WEBHOOK_SECRET;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (secret) headers.Authorization = `Bearer ${secret}`;

  void fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(event),
    signal:
      typeof AbortSignal !== "undefined" && "timeout" in AbortSignal
        ? AbortSignal.timeout(4000)
        : undefined,
  }).catch(() => {});
}
