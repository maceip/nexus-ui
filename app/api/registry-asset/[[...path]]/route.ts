import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { extname, join, relative, resolve } from "path";
import { recordInstallEvent } from "@/lib/install-tracking";

const CWD = process.cwd();
const PUBLIC = resolve(join(CWD, "public"));

function resolveUnderPublic(segments: string[]): string | null {
  if (segments.length < 2) return null;
  const root = segments[0];
  if (root !== "r" && root !== "registry") return null;
  if (segments.some((s) => s.includes(".."))) return null;

  const abs = resolve(PUBLIC, ...segments);
  const rel = relative(PUBLIC, abs);
  if (rel.startsWith("..") || rel === "") return null;

  return abs;
}

function contentTypeForFile(filePath: string): string {
  const ext = extname(filePath).slice(1);
  if (ext === "json") return "application/json";
  if (ext === "tsx" || ext === "ts") return "text/typescript";
  if (ext === "css") return "text/css";
  return "text/plain";
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  const segments = (await params).path ?? [];
  const abs = resolveUnderPublic(segments);
  if (!abs) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const publicPath = "/" + segments.join("/");
  const ua = request.headers.get("user-agent");
  const isItemJson =
    segments[0] === "r" &&
    segments.length === 2 &&
    segments[1].endsWith(".json");

  recordInstallEvent({
    kind: isItemJson ? "registry-item-json" : "registry-source-file",
    path: publicPath,
    userAgent: ua,
  });

  try {
    const body = await readFile(abs, "utf-8");
    const ct = contentTypeForFile(abs);

    if (segments[0] === "r" && segments[1]?.endsWith(".json")) {
      return NextResponse.json(JSON.parse(body), {
        headers: { "Cache-Control": "public, max-age=3600, s-maxage=3600" },
      });
    }

    return new NextResponse(body, {
      headers: {
        "Content-Type": ct,
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
      },
    });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    throw err;
  }
}
