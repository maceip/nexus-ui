import { NextResponse } from "next/server";
import { fetchRecentRepos, scanRepository } from "@/lib/home/repo-ingest/github";
import type { AuthMode } from "@/lib/home/repo-ingest/shared";

type RecentRequest = {
  action: "recent";
  authMode?: AuthMode;
  pat?: string;
};

type ScanRequest = {
  action: "scan";
  authMode?: AuthMode;
  pat?: string;
  repo?: string;
};

type RepoIngestRequest = RecentRequest | ScanRequest;

function toRouteError(error: unknown) {
  const message =
    error instanceof Error ? error.message : "Unknown repo ingest error.";
  return NextResponse.json({ ok: false, error: message }, { status: 400 });
}

export async function POST(request: Request) {
  let body: RepoIngestRequest;

  try {
    body = (await request.json()) as RepoIngestRequest;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON payload." },
      { status: 400 },
    );
  }

  try {
    if (body.action === "recent") {
      const repos = await fetchRecentRepos(
        body.pat ?? "",
        body.authMode ?? "pat",
      );
      return NextResponse.json({ ok: true, repos });
    }

    const repo = body.repo?.trim();
    if (!repo) {
      return NextResponse.json(
        { ok: false, error: "Repository is required." },
        { status: 400 },
      );
    }

    const result = await scanRepository({
      token: body.pat,
      repoFullName: repo,
      authMode: body.authMode ?? "pat",
    });

    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return toRouteError(error);
  }
}
