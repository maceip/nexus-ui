"use client";

import * as React from "react";
import {
  ArrowRight01Icon,
  ArrowUp02Icon,
  CheckmarkCircle03Icon,
  Github01Icon,
  Key01Icon,
  LinkSquare02Icon,
  SearchList01Icon,
  SquareIcon,
  StarsIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PromptInput, PromptInputAction, PromptInputActionGroup, PromptInputActions, PromptInputTextarea } from "@/components/nexus-ui/prompt-input";
import { Suggestions, Suggestion, SuggestionList } from "@/components/nexus-ui/suggestions";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { getModuleIcon } from "@/lib/home/repo-ingest/catalog";
import { repoScanStore } from "@/lib/home/repo-ingest/browser-db";
import type {
  AuthMode,
  BucketGroup,
  IngestMode,
  RepoScanResult,
  RepoSuggestion,
} from "@/lib/home/repo-ingest/shared";
import { ARCHITECTURE_BUCKETS, LANGUAGE_PROFILES } from "@/lib/home/repo-ingest/shared";

type ScanState = "idle" | "loading" | "done" | "error";

type PersistedRecord = {
  repoFullName: string;
  storedAt: string;
  result: RepoScanResult;
};

type RepoScanResponse =
  | { ok: true; repos: RepoSuggestion[] }
  | { ok: true; result: RepoScanResult }
  | { ok: false; error: string };

const AUTH_SUGGESTIONS = [
  "vercel/next.js",
  "facebook/react",
  "tailwindlabs/tailwindcss",
  "victorcodess/nexus-ui",
];

function safeJsonParse<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function normalizeRepoCandidate(value: string) {
  const trimmed = value.trim().replace(/^https?:\/\/github\.com\//, "");
  return trimmed.replace(/\.git$/, "").replace(/^github\.com\//, "");
}

function GitHubMark() {
  return (
    <div className="flex size-9 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-white shadow-sm">
      <HugeiconsIcon icon={Github01Icon} strokeWidth={1.8} className="size-4.5" />
    </div>
  );
}

function MetricPill({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border px-3 py-2",
        accent
          ? "border-cyan-400/30 bg-cyan-400/10 text-cyan-100"
          : "border-white/10 bg-white/[0.04] text-gray-200",
      )}
    >
      <div className="text-[11px] uppercase tracking-[0.24em] text-gray-400">
        {label}
      </div>
      <div className="mt-1 text-sm font-medium">{value}</div>
    </div>
  );
}

function AuthHud({
  authMode,
  onAuthModeChange,
  pat,
  onPatChange,
  recentCount,
}: {
  authMode: AuthMode;
  onAuthModeChange: (value: AuthMode) => void;
  pat: string;
  onPatChange: (value: string) => void;
  recentCount: number;
}) {
  return (
    <div className="rounded-[26px] border border-white/10 bg-black/30 p-3 text-white shadow-2xl backdrop-blur-xl">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium">GitHub auth HUD</div>
          <div className="text-xs text-gray-400">
            Keeps auth scoped to this component only.
          </div>
        </div>
        <div className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2.5 py-1 text-[11px] font-medium tracking-wide text-emerald-200">
          low profile
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          variant={authMode === "pat" ? "secondary" : "ghost"}
          size="sm"
          className="rounded-full bg-white/10 text-white hover:bg-white/15"
          onClick={() => onAuthModeChange("pat")}
        >
          <HugeiconsIcon icon={Key01Icon} className="size-4" strokeWidth={1.8} />
          Use PAT
        </Button>
        <Button
          type="button"
          variant={authMode === "backup" ? "secondary" : "ghost"}
          size="sm"
          className="rounded-full bg-white/10 text-white hover:bg-white/15"
          onClick={() => onAuthModeChange("backup")}
        >
          <HugeiconsIcon icon={Github01Icon} className="size-4" strokeWidth={1.8} />
          Backup token
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="rounded-full border border-white/10 bg-transparent text-white/90 hover:bg-white/10"
          disabled
        >
          OAuth ready
        </Button>
      </div>

      <label className="mt-3 block">
        <span className="mb-1.5 block text-[11px] uppercase tracking-[0.18em] text-gray-400">
          Personal access token
        </span>
        <input
          type="password"
          value={pat}
          onChange={(event) => onPatChange(event.target.value)}
          placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
          className="h-10 w-full rounded-2xl border border-white/10 bg-white/5 px-3 text-sm text-white outline-none ring-0 placeholder:text-gray-500 focus:border-cyan-400/50"
        />
      </label>

      <div className="mt-3 flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-gray-300">
        <div className="flex items-center gap-2">
          <HugeiconsIcon icon={SearchList01Icon} className="size-4" strokeWidth={1.8} />
          Autocomplete seeded from your recent repos
        </div>
        <div className="rounded-full bg-white/10 px-2 py-1 text-[11px] text-white">
          {recentCount}/10 loaded
        </div>
      </div>
    </div>
  );
}

function VendorChip({
  name,
  svg,
  tone = "default",
}: {
  name: string;
  svg?: { path: string; hex: string; title: string };
  tone?: "default" | "accent";
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-2.5 py-1.5 text-xs font-medium",
        tone === "accent"
          ? "border-cyan-400/30 bg-cyan-400/10 text-cyan-100"
          : "border-white/10 bg-white/[0.04] text-gray-200",
      )}
    >
      <span className="flex size-5 items-center justify-center rounded-full bg-white/10">
        {svg ? (
          <svg
            viewBox="0 0 24 24"
            className="size-3.5"
            aria-hidden
            fill={`#${svg.hex}`}
          >
            <path d={svg.path} />
          </svg>
        ) : (
          <span className="text-[10px] uppercase text-white/70">
            {name.slice(0, 2)}
          </span>
        )}
      </span>
      <span>{name}</span>
    </div>
  );
}

function BucketCard({ group }: { group: BucketGroup }) {
  const [open, setOpen] = React.useState(group.modules.length > 0);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="rounded-[24px] border border-white/10 bg-white/[0.035]">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left"
          >
            <div>
              <div className="text-sm font-medium text-white">{group.bucket.title}</div>
              <div className="mt-1 text-xs text-gray-400">
                {group.bucket.description}
              </div>
            </div>
            <div className="rounded-full border border-white/10 bg-white/10 px-2.5 py-1 text-[11px] text-white">
              {group.modules.length}
            </div>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border-t border-white/10 px-4 py-3">
            {group.modules.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {group.modules.map((module) => (
                  <VendorChip
                    key={`${group.bucket.id}-${module.moduleName}-${module.manifestPath}`}
                    name={module.displayName}
                    svg={module.icon}
                    tone={module.matchKind === "catalog" ? "accent" : "default"}
                  />
                ))}
              </div>
            ) : (
              <div className="text-xs text-gray-500">
                No mapped modules from the detected manifests yet.
              </div>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

function StoredScanRail({
  records,
  onRestore,
}: {
  records: PersistedRecord[];
  onRestore: (record: PersistedRecord) => void;
}) {
  return (
    <div className="rounded-[28px] border border-black/10 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-gray-950/80">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-gray-950 dark:text-white">
            Local OPFS scan shelf
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            SQLite WASM persists previous repo scans inside the browser.
          </div>
        </div>
        <div className="rounded-full border border-black/10 bg-black/[0.03] px-2.5 py-1 text-[11px] dark:border-white/10 dark:bg-white/5 dark:text-white">
          {records.length} saved
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {records.length > 0 ? (
          records.map((record) => (
            <button
              key={`${record.repoFullName}-${record.storedAt}`}
              type="button"
              className="flex w-full items-center justify-between rounded-2xl border border-black/8 bg-black/[0.02] px-3 py-2 text-left transition hover:bg-black/[0.04] dark:border-white/10 dark:bg-white/[0.03] dark:hover:bg-white/[0.06]"
              onClick={() => onRestore(record)}
            >
              <div>
                <div className="text-sm font-medium text-gray-900 dark:text-white">
                  {record.repoFullName}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {new Date(record.storedAt).toLocaleString()}
                </div>
              </div>
              <HugeiconsIcon icon={ArrowRight01Icon} className="size-4 text-gray-500" strokeWidth={1.8} />
            </button>
          ))
        ) : (
          <div className="rounded-2xl border border-dashed border-black/10 px-3 py-4 text-sm text-gray-500 dark:border-white/10 dark:text-gray-400">
            Run a single repo ingest to seed local storage.
          </div>
        )}
      </div>
    </div>
  );
}

function TwinRepoPreview() {
  return (
    <div className="flex h-full min-h-[640px] flex-col justify-between rounded-[36px] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(12,74,110,0.4),transparent_50%),linear-gradient(180deg,#030712_0%,#0f172a_100%)] p-6 text-white shadow-[0_40px_120px_-48px_rgba(8,145,178,0.8)]">
      <div>
        <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs text-cyan-100">
          <HugeiconsIcon icon={LinkSquare02Icon} className="size-4" strokeWidth={1.8} />
          twin repo ingest
        </div>
        <h3 className="mt-4 text-2xl font-medium tracking-[-0.03em]">
          Compare upstream, downstream, and shared vendors.
        </h3>
        <p className="mt-2 max-w-xl text-sm leading-6 text-gray-300">
          The second tab previews the next motion pattern: two repos, merged
          manifests, and cross-repo vendor drift analysis. This pass keeps it
          visible while shipping only the full GitHub single repo flow.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {[
          {
            title: "Repo A",
            subtitle: "design-system/web",
            items: ["Next.js", "Tailwind CSS", "Sentry", "LaunchDarkly"],
          },
          {
            title: "Repo B",
            subtitle: "platform/api",
            items: ["PostgreSQL", "Redis", "OpenTelemetry", "Kafka"],
          },
        ].map((panel) => (
          <div
            key={panel.title}
            className="rounded-[28px] border border-white/10 bg-white/[0.04] p-4"
          >
            <div className="text-xs uppercase tracking-[0.22em] text-gray-400">
              {panel.title}
            </div>
            <div className="mt-1 text-lg font-medium">{panel.subtitle}</div>
            <div className="mt-4 flex flex-wrap gap-2">
              {panel.items.map((item) => (
                <VendorChip key={item} name={item} svg={getModuleIcon(item)} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function HomeRepoIngestShowcase() {
  const [mode, setMode] = React.useState<IngestMode>("single");
  const [authMode, setAuthMode] = React.useState<AuthMode>("pat");
  const [pat, setPat] = React.useState("");
  const [input, setInput] = React.useState("");
  const [status, setStatus] = React.useState<ScanState>("idle");
  const [error, setError] = React.useState<string | null>(null);
  const [recentRepos, setRecentRepos] = React.useState<RepoSuggestion[]>([]);
  const [scan, setScan] = React.useState<RepoScanResult | null>(null);
  const [storedScans, setStoredScans] = React.useState<PersistedRecord[]>([]);

  React.useEffect(() => {
    const storedToken = window.localStorage.getItem("repo-ingest-pat");
    if (storedToken) {
      setPat(storedToken);
    }

    const savedInput = window.localStorage.getItem("repo-ingest-last-input");
    if (savedInput) {
      setInput(savedInput);
    }

    void repoScanStore.list().then(setStoredScans);
  }, []);

  React.useEffect(() => {
    if (!pat.trim()) {
      setRecentRepos([]);
      return;
    }

    window.localStorage.setItem("repo-ingest-pat", pat);

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      try {
        const response = await fetch("/api/repo-ingest", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "recent",
            authMode,
            pat,
          }),
          signal: controller.signal,
        });
        const payload = (await response.json()) as RepoScanResponse;
        if (!response.ok || !payload.ok || !("repos" in payload)) {
          throw new Error(payload.ok ? "Could not load repos." : payload.error);
        }
        setRecentRepos(payload.repos.slice(0, 10));
      } catch (fetchError) {
        if ((fetchError as Error).name !== "AbortError") {
          setRecentRepos([]);
        }
      }
    }, 250);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [authMode, pat]);

  const suggestions = React.useMemo(() => {
    const normalized = normalizeRepoCandidate(input).toLowerCase();
    const fromRecent = recentRepos.filter((repo) =>
      repo.fullName.toLowerCase().includes(normalized),
    );
    if (!normalized) {
      return fromRecent.slice(0, 6);
    }
    return fromRecent.slice(0, 6);
  }, [input, recentRepos]);

  const highlightedRepo = suggestions[0]?.fullName ?? AUTH_SUGGESTIONS[0];

  const runScan = React.useCallback(
    async (candidate?: string) => {
      const repo = normalizeRepoCandidate(candidate ?? input);
      if (!repo) {
        setError("Enter a repo in owner/name format.");
        setStatus("error");
        return;
      }

      setStatus("loading");
      setError(null);
      window.localStorage.setItem("repo-ingest-last-input", repo);

      try {
        const response = await fetch("/api/repo-ingest", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "scan",
            authMode,
            pat,
            repo,
          }),
        });
        const payload = (await response.json()) as RepoScanResponse;

        if (!response.ok || !payload.ok || !("result" in payload)) {
          throw new Error(payload.ok ? "Repo scan failed." : payload.error);
        }

        setScan(payload.result);
        setStatus("done");
        await repoScanStore.save(payload.result);
        const records = await repoScanStore.list();
        setStoredScans(records);
      } catch (scanError) {
        setStatus("error");
        setError((scanError as Error).message);
      }
    },
    [authMode, input, pat],
  );

  const statusCopy = React.useMemo(() => {
    switch (status) {
      case "loading":
        return "Cloning signal, scanning manifests, and mapping vendors...";
      case "done":
        return scan
          ? `Mapped ${scan.summary.mappedModules} modules across ${scan.summary.manifestsScanned} manifests.`
          : "Repo scanned.";
      case "error":
        return error ?? "Repo scan failed.";
      default:
        return "Paste a repo or authenticate to seed autocomplete from your latest commits.";
    }
  }, [error, scan, status]);

  const groupedBuckets = React.useMemo(() => {
    if (!scan) {
      return ARCHITECTURE_BUCKETS.map((bucket) => ({
        bucket,
        modules: [],
      }));
    }

    return scan.bucketGroups;
  }, [scan]);

  const frontendBuckets = groupedBuckets.filter(
    (group) => group.bucket.layer === "frontend",
  );
  const backendBuckets = groupedBuckets.filter(
    (group) => group.bucket.layer === "backend",
  );

  const languageChips = scan?.detectedLanguages ?? LANGUAGE_PROFILES.slice(0, 6);

  return (
    <section className="w-full px-4 pb-8 md:px-6 md:pb-10">
      <div className="rounded-[40px] border border-black/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(244,244,245,0.96))] p-3 shadow-[0_24px_120px_-56px_rgba(0,0,0,0.35)] dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(2,6,23,0.97),rgba(10,15,28,0.97))]">
        <Tabs
          value={mode}
          onValueChange={(value) => setMode(value as IngestMode)}
          className="w-full"
        >
          <div className="flex flex-col gap-4 rounded-[32px] bg-gray-950 p-5 text-white md:p-7">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs tracking-[0.16em] text-cyan-100 uppercase">
                  <HugeiconsIcon icon={StarsIcon} className="size-4" strokeWidth={1.8} />
                  repo ingest showcase
                </div>
                <h2 className="mt-4 text-3xl font-medium tracking-[-0.04em] md:text-4xl">
                  Ingest GitHub repos directly from a context-aware input.
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-300 md:text-base">
                  This extension adds two product surfaces to the app page: a
                  shipped single repo ingest card for GitHub and a visible twin
                  repo ingest preview. The single flow authenticates in-place,
                  autocompletes recent repos, scans manifests for the requested
                  top 15 languages, maps modules into 24 frontend/backend
                  buckets, and stores each result in browser OPFS via SQLite
                  WASM.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <MetricPill label="Modes" value="Single + Twin" accent />
                <MetricPill
                  label="Persistence"
                  value="OPFS + SQLite WASM"
                />
                <MetricPill label="Autocomplete" value="Latest 10 repos" />
              </div>
            </div>

            <TabsList className="inline-flex w-fit rounded-full border border-white/10 bg-white/5 p-1">
              <TabsTrigger
                value="single"
                className="rounded-full px-4 py-2 text-sm text-white data-[state=active]:bg-white data-[state=active]:text-black"
              >
                Single repo ingest
              </TabsTrigger>
              <TabsTrigger
                value="twin"
                className="rounded-full px-4 py-2 text-sm text-white data-[state=active]:bg-white data-[state=active]:text-black"
              >
                Twin repo ingest
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="single" className="mt-0">
            <div className="grid gap-4 p-3 lg:grid-cols-[1.25fr_0.75fr]">
              <div className="overflow-hidden rounded-[36px] border border-black/10 bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.08),transparent_32%),linear-gradient(180deg,#030712_0%,#111827_100%)] p-5 text-white shadow-[0_50px_120px_-60px_rgba(34,211,238,0.7)] md:p-6">
                <div className="flex flex-col gap-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <GitHubMark />
                      <div>
                        <div className="text-lg font-medium">
                          Single repo ingest
                        </div>
                        <div className="text-sm text-gray-400">
                          GitHub-first, non-blocking, component-scoped ingest.
                        </div>
                      </div>
                    </div>
                    <div className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs text-cyan-100">
                      shipped now
                    </div>
                  </div>

                  <AuthHud
                    authMode={authMode}
                    onAuthModeChange={setAuthMode}
                    pat={pat}
                    onPatChange={setPat}
                    recentCount={recentRepos.length}
                  />

                  <div className="rounded-[30px] border border-white/10 bg-white/[0.04] p-3">
                    <PromptInput
                      onSubmit={(value) => {
                        void runScan(value);
                      }}
                      className="border-white/10 bg-black/20"
                    >
                      <PromptInputTextarea
                        value={input}
                        onChange={(event) => setInput(event.target.value)}
                        placeholder="Type a GitHub repo, e.g. owner/name or github.com/owner/name"
                        className="min-h-18 text-white placeholder:text-gray-500"
                        disabled={status === "loading"}
                      />
                      <PromptInputActions className="border-t border-white/10">
                        <PromptInputActionGroup>
                          <Popover>
                            <PromptInputAction asChild>
                              <PopoverTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="rounded-full bg-white/10 text-white hover:bg-white/15"
                                >
                                  <HugeiconsIcon
                                    icon={SearchList01Icon}
                                    className="size-4"
                                    strokeWidth={1.8}
                                  />
                                  Recent repos
                                </Button>
                              </PopoverTrigger>
                            </PromptInputAction>
                            <PopoverContent
                              align="start"
                              className="w-[320px] rounded-[24px] border-white/10 bg-gray-950/95 p-2 text-white"
                            >
                              <div className="px-2 pb-2 text-xs uppercase tracking-[0.18em] text-gray-400">
                                Most recently committed repos
                              </div>
                              <div className="space-y-1">
                                {(recentRepos.length > 0
                                  ? recentRepos
                                  : AUTH_SUGGESTIONS.map((fullName, index) => ({
                                      id: index,
                                      fullName,
                                      owner: fullName.split("/")[0] ?? "",
                                      name: fullName.split("/")[1] ?? "",
                                      description: "Seed suggestion",
                                      pushedAt: new Date().toISOString(),
                                      private: false,
                                      defaultBranch: "main",
                                    }))).map((repo) => (
                                  <button
                                    key={`${repo.id}-${repo.fullName}`}
                                    type="button"
                                    className="block w-full rounded-2xl px-3 py-2 text-left transition hover:bg-white/10"
                                    onClick={() => setInput(repo.fullName)}
                                  >
                                    <div className="text-sm font-medium">
                                      {repo.fullName}
                                    </div>
                                    <div className="text-xs text-gray-400">
                                      {repo.description ?? "GitHub repository"}
                                    </div>
                                  </button>
                                ))}
                              </div>
                            </PopoverContent>
                          </Popover>
                        </PromptInputActionGroup>

                        <PromptInputActionGroup>
                          <PromptInputAction asChild>
                            <Button
                              type="button"
                              size="icon-sm"
                              className="rounded-full"
                              disabled={status === "loading" || !normalizeRepoCandidate(input)}
                              onClick={() => void runScan()}
                            >
                              {status === "loading" ? (
                                <HugeiconsIcon
                                  icon={SquareIcon}
                                  className="size-3.5 fill-current"
                                  strokeWidth={2}
                                />
                              ) : (
                                <HugeiconsIcon
                                  icon={ArrowUp02Icon}
                                  className="size-4"
                                  strokeWidth={2}
                                />
                              )}
                            </Button>
                          </PromptInputAction>
                        </PromptInputActionGroup>
                      </PromptInputActions>
                    </PromptInput>

                    <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-gray-300">
                      {statusCopy}
                    </div>
                  </div>

                  <Suggestions onSelect={(value) => setInput(value)}>
                    <SuggestionList className="justify-start">
                      {suggestions.length > 0
                        ? suggestions.map((repo) => (
                            <Suggestion key={repo.fullName} value={repo.fullName}>
                              {repo.fullName}
                            </Suggestion>
                          ))
                        : AUTH_SUGGESTIONS.map((suggestion) => (
                            <Suggestion key={suggestion} value={suggestion}>
                              {suggestion}
                            </Suggestion>
                          ))}
                    </SuggestionList>
                  </Suggestions>

                  <div className="grid gap-4 lg:grid-cols-[0.75fr_1.25fr]">
                    <div className="rounded-[30px] border border-white/10 bg-white/[0.035] p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-medium text-white">
                            Scan telemetry
                          </div>
                          <div className="text-xs text-gray-400">
                            Recent autocomplete, manifest discovery, and local
                            storage status.
                          </div>
                        </div>
                        {scan ? (
                          <div className="inline-flex items-center gap-1 rounded-full bg-emerald-400/10 px-2 py-1 text-[11px] text-emerald-200">
                            <HugeiconsIcon
                              icon={CheckmarkCircle03Icon}
                              className="size-3.5"
                              strokeWidth={1.8}
                            />
                            cached
                          </div>
                        ) : null}
                      </div>

                      <div className="mt-4 grid gap-3">
                        <MetricPill
                          label="Autocomplete lead"
                          value={highlightedRepo}
                          accent
                        />
                        <MetricPill
                          label="Detected languages"
                          value={
                            scan
                              ? scan.detectedLanguages
                                  .map((language) => language.title)
                                  .join(", ")
                              : "Waiting for repo scan"
                          }
                        />
                        <MetricPill
                          label="Modules mapped"
                          value={
                            scan
                              ? `${scan.summary.mappedModules} of ${scan.summary.moduleCount}`
                              : "0 of 0"
                          }
                        />
                      </div>

                      <div className="mt-4 rounded-[24px] border border-white/10 bg-black/20 p-3">
                        <div className="text-xs uppercase tracking-[0.18em] text-gray-400">
                          Language watchlist
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {languageChips.map((language) => (
                            <VendorChip
                              key={language.key}
                              name={`${language.rank}. ${language.title}`}
                              tone="accent"
                            />
                          ))}
                        </div>
                      </div>
                    </div>

                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25, ease: "easeOut" }}
                      className="rounded-[30px] border border-white/10 bg-white/[0.035] p-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-medium text-white">
                            Vendor cloud
                          </div>
                          <div className="text-xs text-gray-400">
                            Modules grouped into 12 frontend and 12 backend
                            architecture buckets.
                          </div>
                        </div>
                        <div className="rounded-full border border-white/10 bg-white/10 px-2.5 py-1 text-[11px] text-white">
                          {scan?.repoFullName ?? "no repo yet"}
                        </div>
                      </div>

                      {error ? (
                        <div className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-400/10 px-3 py-3 text-sm text-rose-100">
                          {error}
                        </div>
                      ) : null}

                      <div className="mt-4 grid gap-4 xl:grid-cols-2">
                        <div className="space-y-3">
                          <div className="text-xs uppercase tracking-[0.18em] text-gray-500">
                            Frontend
                          </div>
                          {frontendBuckets.map((group) => (
                            <BucketCard key={group.bucket.id} group={group} />
                          ))}
                        </div>
                        <div className="space-y-3">
                          <div className="text-xs uppercase tracking-[0.18em] text-gray-500">
                            Backend
                          </div>
                          {backendBuckets.map((group) => (
                            <BucketCard key={group.bucket.id} group={group} />
                          ))}
                        </div>
                      </div>

                      {scan?.unmatchedModules.length ? (
                        <div className="mt-4 rounded-[24px] border border-white/10 bg-black/20 p-3">
                          <div className="text-xs uppercase tracking-[0.18em] text-gray-400">
                            Unmatched modules
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {scan.unmatchedModules.slice(0, 18).map((moduleName) => (
                              <VendorChip
                                key={moduleName}
                                name={moduleName}
                                svg={getModuleIcon(moduleName)}
                              />
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </motion.div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <StoredScanRail
                  records={storedScans}
                  onRestore={(record) => {
                    setScan(record.result);
                    setInput(record.repoFullName);
                    setStatus("done");
                    setError(null);
                  }}
                />

                <div className="rounded-[28px] border border-black/10 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-gray-950/80">
                  <div className="text-sm font-medium text-gray-950 dark:text-white">
                    Module icon cloud
                  </div>
                  <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Pulls local SVG logo metadata keyed by package name, with
                    graceful fallbacks for unmatched modules.
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {[
                      "github",
                      "nextdotjs",
                      "react",
                      "tailwindcss",
                      "postgresql",
                      "redis",
                      "docker",
                      "opentelemetry",
                    ].map((slug) => (
                      <VendorChip
                        key={slug}
                        name={slug}
                        svg={getModuleIcon(slug)}
                        tone="accent"
                      />
                    ))}
                  </div>
                </div>

                <div className="rounded-[28px] border border-black/10 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-gray-950/80">
                  <div className="text-sm font-medium text-gray-950 dark:text-white">
                    What this pass ships
                  </div>
                  <ul className="mt-3 space-y-2 text-sm leading-6 text-gray-600 dark:text-gray-300">
                    <li>Single repo GitHub ingest with inline auth HUD.</li>
                    <li>Recent-repo autocomplete seeded from user activity.</li>
                    <li>Manifest scan + dependency bucketing across 24 domains.</li>
                    <li>Browser OPFS persistence via SQLite WASM export/import.</li>
                  </ul>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="twin" className="mt-0 p-3">
            <TwinRepoPreview />
          </TabsContent>
        </Tabs>
      </div>
    </section>
  );
}
