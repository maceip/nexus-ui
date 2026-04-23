"use client";

import * as React from "react";
import {
  ArrowRight01Icon,
  CheckmarkCircle03Icon,
  Github01Icon,
  Key01Icon,
  LinkSquare02Icon,
  SearchList01Icon,
  SparklesIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Suggestions, Suggestion, SuggestionList } from "@/components/nexus-ui/suggestions";
import {
  ContextualTextInput,
  validateContextualInput,
} from "@/components/nexus-ui/contextual-text-input";
import { RepoCard } from "@/components/nexus-ui/repo-card";
import type { GitHubRepoData } from "@/components/nexus-ui/repo-card";
import { FileTree, type FileTreeNode } from "@/components/nexus-ui/file-tree";
import { ActivityGraph } from "@/components/nexus-ui/activity-graph";
import { CommitGraph } from "@/components/nexus-ui/commit-graph";
import { cn } from "@/lib/utils";
import { getModuleIcon } from "@/lib/home/repo-ingest/catalog";
import {
  repoScanStore,
  type StoredRepoScanRecord,
} from "@/lib/home/repo-ingest/browser-db";
import type {
  AuthMode,
  BucketGroup,
  BucketModuleMatch,
  IngestMode,
  RepoActivityEntry,
  RepoCommitSummary,
  RepoScanResult,
  RepoSuggestion,
} from "@/lib/home/repo-ingest/shared";
import {
  ARCHITECTURE_BUCKETS,
  LANGUAGE_PROFILES,
} from "@/lib/home/repo-ingest/shared";

type ScanState = "idle" | "loading" | "done" | "error";

type RepoScanResponse =
  | { ok: true; repos: RepoSuggestion[] }
  | { ok: true; result: RepoScanResult }
  | { ok: false; error: string };

const AUTH_SUGGESTIONS = [
  "github.com/vercel/next.js",
  "github.com/facebook/react",
  "github.com/tailwindlabs/tailwindcss",
  "github.com/maceip/nexus-ui",
] as const;

function normalizeRepoCandidate(value: string) {
  const normalized = value
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^github\.com\//i, "")
    .replace(/\/+$/, "");
  return normalized;
}

function toGithubInputValue(repoFullName: string) {
  return `github.com/${repoFullName}`;
}

function normalizeGithubInputValue(value: string) {
  const normalized = normalizeRepoCandidate(value);
  if (!normalized) return "";
  return `github.com/${normalized}`;
}

function MetricPill({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-white">
      <div className="text-[11px] uppercase tracking-[0.18em] text-white/50">
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
    <div className="rounded-2xl border border-border/70 bg-card/90 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="text-sm font-medium text-foreground">
            GitHub auth HUD
          </div>
          <div className="text-xs text-muted-foreground">
            Inline auth only. No page-blocking overlay.
          </div>
        </div>
        <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
          low profile
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant={authMode === "pat" ? "secondary" : "outline"}
          className="rounded-full"
          onClick={() => onAuthModeChange("pat")}
        >
          <HugeiconsIcon icon={Key01Icon} className="size-4" strokeWidth={1.8} />
          Use PAT
        </Button>
        <Button
          type="button"
          size="sm"
          variant={authMode === "backup" ? "secondary" : "outline"}
          className="rounded-full"
          onClick={() => onAuthModeChange("backup")}
        >
          <HugeiconsIcon
            icon={Github01Icon}
            className="size-4"
            strokeWidth={1.8}
          />
          Backup token
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="rounded-full"
          disabled
        >
          OAuth ready
        </Button>
      </div>

      <label className="mt-4 block space-y-1.5">
        <span className="text-[11px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
          Personal access token
        </span>
        <input
          type="password"
          value={pat}
          onChange={(event) => onPatChange(event.target.value)}
          placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
          className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring"
        />
      </label>

      <div className="mt-4 flex items-center justify-between rounded-xl border border-border/80 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <HugeiconsIcon
            icon={SearchList01Icon}
            className="size-4"
            strokeWidth={1.8}
          />
          Autocomplete seeded from your latest 10 repos
        </div>
        <span className="rounded-full bg-background px-2 py-1 text-[11px] text-foreground">
          {recentCount}/10
        </span>
      </div>
    </div>
  );
}

function VendorChip({
  module,
}: {
  module: Pick<BucketModuleMatch, "displayName" | "icon" | "matchKind">;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-medium",
        module.matchKind === "catalog"
          ? "border-primary/15 bg-primary/8 text-foreground"
          : "border-border bg-muted/50 text-muted-foreground",
      )}
    >
      <span className="flex size-4.5 items-center justify-center rounded-full bg-background">
        {module.icon ? (
          <svg
            viewBox="0 0 24 24"
            className="size-3"
            fill={`#${module.icon.hex}`}
            aria-hidden
          >
            <path d={module.icon.path} />
          </svg>
        ) : (
          <span className="text-[9px] uppercase">
            {module.displayName.slice(0, 2)}
          </span>
        )}
      </span>
      {module.displayName}
    </span>
  );
}

function BucketCloud({
  title,
  groups,
}: {
  title: string;
  groups: BucketGroup[];
}) {
  return (
    <div className="space-y-3">
      <div className="text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase">
        {title}
      </div>
      {groups.map((group) => (
        <div
          key={group.bucket.id}
          className="rounded-2xl border border-border bg-card p-4 shadow-sm"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-medium text-foreground">
                {group.bucket.title}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {group.bucket.description}
              </div>
            </div>
            <span className="rounded-full bg-muted px-2 py-1 text-[11px] text-muted-foreground">
              {group.modules.length}
            </span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {group.modules.length > 0 ? (
              group.modules.map((module) => (
                <VendorChip
                  key={`${group.bucket.id}-${module.moduleName}-${module.manifestPath}`}
                  module={module}
                />
              ))
            ) : (
              <span className="text-xs text-muted-foreground">
                No mapped modules yet.
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function toFileTree(manifests: RepoScanResult["manifests"]): FileTreeNode[] {
  const root: FileTreeNode[] = [];

  function insert(parts: string[], nodes: FileTreeNode[]) {
    const [head, ...rest] = parts;
    if (!head) return;

    let current = nodes.find((node) => node.name === head);
    if (!current) {
      current = rest.length > 0 ? { name: head, children: [] } : { name: head };
      nodes.push(current);
    }

    if (rest.length > 0) {
      current.children ??= [];
      insert(rest, current.children);
    }
  }

  for (const manifest of manifests) {
    insert(manifest.manifestPath.split("/"), root);
  }

  return root;
}

function buildFileTreeHighlights(manifests: RepoScanResult["manifests"]) {
  return manifests.slice(0, 6).map((manifest) => manifest.manifestPath);
}

function toCommitGraph(commits: RepoCommitSummary[]) {
  return commits.map((commit) => ({
    hash: commit.hash,
    message: commit.message,
    author: {
      name: commit.author.name,
      avatarUrl: commit.author.avatarUrl,
    },
    date: commit.date,
    parents: commit.parents,
    refs: commit.refs,
    tag: commit.tag,
  }));
}

function toRepoCardData(scan: RepoScanResult | null): GitHubRepoData | null {
  if (!scan?.repo) return null;

  return {
    id: scan.repo.id,
    name: scan.repo.name,
    full_name: scan.repo.fullName,
    html_url: scan.repo.htmlUrl,
    description: scan.repo.description,
    stargazers_count: scan.repo.stargazersCount,
    forks_count: scan.repo.forksCount,
    language: scan.repo.language,
    topics: scan.repo.topics,
    archived: scan.repo.archived,
    fork: scan.repo.fork,
    updated_at: scan.repo.updatedAt,
    license: scan.repo.license
      ? {
          key: scan.repo.license.key,
          name: scan.repo.license.name,
          spdx_id: scan.repo.license.spdxId,
        }
      : null,
    owner: {
      login: scan.repo.owner.login,
      avatar_url: scan.repo.owner.avatarUrl,
      html_url: scan.repo.owner.htmlUrl,
    },
  };
}

function buildFallbackActivity() {
  return Array.from({ length: 91 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (90 - index));
    return {
      date: date.toISOString().slice(0, 10),
      count: Math.max(0, Math.round((Math.sin(index / 6) + 1) * 2 + (index % 4))),
    } satisfies RepoActivityEntry;
  });
}

function normalizeScanResult(scan: RepoScanResult): RepoScanResult {
  return {
    ...scan,
    activity: Array.isArray(scan.activity) ? scan.activity : [],
    commits: Array.isArray(scan.commits)
      ? scan.commits
      : Array.isArray((scan as Partial<{ recentCommits: RepoCommitSummary[] }>).recentCommits)
        ? ((scan as Partial<{ recentCommits: RepoCommitSummary[] }>).recentCommits ?? [])
        : [],
    manifestTree: Array.isArray(scan.manifestTree) ? scan.manifestTree : [],
    highlightedPaths: Array.isArray(scan.highlightedPaths)
      ? scan.highlightedPaths
      : [],
    expandedPaths: Array.isArray(scan.expandedPaths) ? scan.expandedPaths : [],
  };
}

function StoredScanRail({
  records,
  onRestore,
}: {
  records: StoredRepoScanRecord[];
  onRestore: (record: StoredRepoScanRecord) => void;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-foreground">
            Local OPFS scan shelf
          </div>
          <div className="text-xs text-muted-foreground">
            SQLite WASM keeps prior scans available in-browser.
          </div>
        </div>
        <span className="rounded-full bg-muted px-2 py-1 text-[11px] text-muted-foreground">
          {records.length} saved
        </span>
      </div>

      <div className="mt-4 space-y-2">
        {records.length > 0 ? (
          records.map((record) => (
            <button
              key={`${record.repoFullName}-${record.storedAt}`}
              type="button"
              className="flex w-full items-center justify-between rounded-xl border border-border bg-background px-3 py-2 text-left transition-colors hover:bg-muted/40"
              onClick={() => onRestore(record)}
            >
              <div>
                <div className="text-sm font-medium text-foreground">
                  {record.repoFullName}
                </div>
                <div className="text-xs text-muted-foreground">
                  {new Date(record.storedAt).toLocaleString()}
                </div>
              </div>
              <HugeiconsIcon
                icon={ArrowRight01Icon}
                className="size-4 text-muted-foreground"
                strokeWidth={1.8}
              />
            </button>
          ))
        ) : (
          <div className="rounded-xl border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
            Run a single repo ingest to seed local storage.
          </div>
        )}
      </div>
    </div>
  );
}

function TwinRepoPreview() {
  return (
    <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
      <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
        <div className="inline-flex items-center gap-2 rounded-full bg-primary/8 px-3 py-1 text-xs font-medium text-primary">
          <HugeiconsIcon
            icon={LinkSquare02Icon}
            className="size-4"
            strokeWidth={1.8}
          />
          Twin repo ingest
        </div>
        <h3 className="mt-4 text-2xl font-medium tracking-[-0.03em] text-foreground">
          Compare upstream, downstream, and shared architecture.
        </h3>
        <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
          This preview now leans on the same repo-native card language from main:
          paired repository summaries, shared commit context, and a future merge
          view for vendor drift across two repos.
        </p>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <RepoCard
            owner="maceip"
            repo="nexus-ui"
            data={{
              id: 1,
              name: "nexus-ui",
              full_name: "maceip/nexus-ui",
              html_url: "https://github.com/maceip/nexus-ui",
              description:
                "Composable Nexus UI primitives for AI-first app surfaces.",
              stargazers_count: 1284,
              forks_count: 164,
              language: "TypeScript",
              topics: ["components", "ai", "design-system", "nextjs"],
              archived: false,
              fork: false,
              updated_at: "2026-04-23T12:00:00.000Z",
              license: { key: "mit", name: "MIT License", spdx_id: "MIT" },
              owner: {
                login: "maceip",
                avatar_url: "https://github.com/maceip.png",
                html_url: "https://github.com/maceip",
              },
            }}
          />
          <RepoCard
            owner="vercel"
            repo="next.js"
            data={{
              id: 2,
              name: "next.js",
              full_name: "vercel/next.js",
              html_url: "https://github.com/vercel/next.js",
              description:
                "The React framework for production with SSR, app router, and tooling.",
              stargazers_count: 132000,
              forks_count: 28500,
              language: "JavaScript",
              topics: ["react", "framework", "ssr", "web"],
              archived: false,
              fork: false,
              updated_at: "2026-04-23T12:00:00.000Z",
              license: { key: "mit", name: "MIT License", spdx_id: "MIT" },
              owner: {
                login: "vercel",
                avatar_url: "https://github.com/vercel.png",
                html_url: "https://github.com/vercel",
              },
            }}
          />
        </div>
      </div>

      <div className="space-y-4">
        <div className="rounded-3xl border border-border bg-card p-4 shadow-sm">
          <div className="text-sm font-medium text-foreground">
            Shared manifest focus
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            Preview of merged package and infra paths for paired ingest.
          </div>
          <div className="mt-4">
            <FileTree
              iconStyle="colored"
              defaultExpanded={["apps", "apps/web", "packages", "infra"]}
              highlight={[
                "apps/web/package.json",
                "packages/ui/package.json",
                "infra/terraform/main.tf",
              ]}
              tree={[
                {
                  name: "apps",
                  children: [
                    {
                      name: "web",
                      children: [{ name: "package.json" }, { name: "next.config.ts" }],
                    },
                  ],
                },
                {
                  name: "packages",
                  children: [{ name: "ui", children: [{ name: "package.json" }] }],
                },
                {
                  name: "infra",
                  children: [{ name: "terraform", children: [{ name: "main.tf" }] }],
                },
              ]}
            />
          </div>
        </div>

        <div className="rounded-3xl border border-border bg-card p-4 shadow-sm">
          <div className="text-sm font-medium text-foreground">
            Twin ingest activity preview
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            Shared contribution tempo across both repos.
          </div>
          <div className="mt-4">
            <ActivityGraph data={buildFallbackActivity()} weeks={13} />
          </div>
        </div>
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
  const [storedScans, setStoredScans] = React.useState<StoredRepoScanRecord[]>([]);
  const [storageLabel, setStorageLabel] = React.useState("SQLite WASM");

  React.useEffect(() => {
    const storedToken = window.localStorage.getItem("repo-ingest-pat");
    if (storedToken) {
      setPat(storedToken);
    }

    const savedInput = window.localStorage.getItem("repo-ingest-last-input");
    if (savedInput) {
      setInput(savedInput);
    }

    setStorageLabel(repoScanStore.label());
    void repoScanStore.list().then((records) =>
      setStoredScans(
        records.map((record) => ({
          ...record,
          result: normalizeScanResult(record.result),
        })),
      ),
    );
  }, []);

  React.useEffect(() => {
    if (authMode === "pat" && !pat.trim()) {
      setRecentRepos([]);
      return;
    }

    if (pat.trim()) {
      window.localStorage.setItem("repo-ingest-pat", pat);
    }

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

  const normalizedInput = normalizeGithubInputValue(input);
  const validation = validateContextualInput("github", normalizedInput);

  const suggestions = React.useMemo(() => {
    const normalizedValue =
      validation.normalizedValue?.replace(/^github\.com\//, "").toLowerCase() ?? "";
    const fromRecent = recentRepos.filter((repo) =>
      repo.fullName.toLowerCase().includes(normalizedValue),
    );
    return fromRecent.slice(0, 6);
  }, [recentRepos, validation.normalizedValue]);

  const highlightedRepo = suggestions[0]?.fullName ?? "vercel/next.js";

  const runScan = React.useCallback(
    async (candidate?: string) => {
      const validated = validateContextualInput(
        "github",
        normalizeGithubInputValue(candidate ?? input),
      );
      const repo =
        validated.normalizedValue?.replace(/^github\.com\//, "") ??
        normalizeRepoCandidate(candidate ?? input);

      if (!repo || !validated.isValid) {
        setError(validated.error ?? "Enter a full GitHub repo URL.");
        setStatus("error");
        return;
      }

      setStatus("loading");
      setError(null);
      window.localStorage.setItem("repo-ingest-last-input", `github.com/${repo}`);

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

        setScan(normalizeScanResult(payload.result));
        setStatus("done");
        await repoScanStore.save(payload.result);
        const records = await repoScanStore.list();
        setStoredScans(
          records.map((record) => ({
            ...record,
            result: normalizeScanResult(record.result),
          })),
        );
      } catch (scanError) {
        setStatus("error");
        setError((scanError as Error).message);
      }
    },
    [authMode, input, pat],
  );

  const groupedBuckets = React.useMemo(() => {
    if (!scan) {
      return ARCHITECTURE_BUCKETS.map((bucket) => ({
        bucket,
        modules: [],
      }));
    }

    return ARCHITECTURE_BUCKETS.map(
      (bucket) =>
        scan.bucketGroups.find((group) => group.bucket.id === bucket.id) ?? {
          bucket,
          modules: [],
        },
    );
  }, [scan]);

  const frontendBuckets = groupedBuckets.filter(
    (group) => group.bucket.layer === "frontend",
  );
  const backendBuckets = groupedBuckets.filter(
    (group) => group.bucket.layer === "backend",
  );

  const languageChips = scan?.detectedLanguages ?? LANGUAGE_PROFILES.slice(0, 6);
  const manifestTree = React.useMemo(
    () => toFileTree(scan?.manifests ?? []),
    [scan?.manifests],
  );
  const highlightPaths = React.useMemo(
    () => buildFileTreeHighlights(scan?.manifests ?? []),
    [scan?.manifests],
  );
  const activityData = scan?.activity.length ? scan.activity : buildFallbackActivity();
  const commitData = toCommitGraph(scan?.commits ?? []);

  const statusCopy = React.useMemo(() => {
    switch (status) {
      case "loading":
        return "Fetching repo context, manifest tree, commit cadence, and vendor buckets...";
      case "done":
        return scan
          ? `Mapped ${scan.summary.mappedModules} modules across ${scan.summary.manifestsScanned} manifests.`
          : "Repo scanned.";
      case "error":
        return error ?? "Repo scan failed.";
      default:
        return "Authenticate in-card, then ingest a GitHub repo through the contextual input.";
    }
  }, [error, scan, status]);

  return (
    <section className="w-full px-4 pb-8 md:px-6 md:pb-10">
      <div className="rounded-[36px] border border-border bg-card/80 p-3 shadow-[0_24px_120px_-56px_rgba(0,0,0,0.25)] backdrop-blur-sm">
        <Tabs
          value={mode}
          onValueChange={(value) => setMode(value as IngestMode)}
          className="w-full"
        >
          <div className="rounded-[28px] border border-border bg-[radial-gradient(circle_at_top,rgba(15,23,42,0.12),transparent_52%),linear-gradient(180deg,rgba(2,6,23,0.96),rgba(15,23,42,0.96))] p-5 text-white md:p-7">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium tracking-[0.16em] uppercase">
                  <HugeiconsIcon
                    icon={SparklesIcon}
                    className="size-4"
                    strokeWidth={1.8}
                  />
                  repo ingest showcase
                </div>
                <h2 className="mt-4 text-3xl font-medium tracking-[-0.04em] md:text-4xl">
                  Single and twin repo ingest, now aligned with the repo-native UI
                  added in main.
                </h2>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-white/70 md:text-base">
                  The single-repo flow now uses the contextual GitHub input, repo
                  card, file tree, activity graph, and commit graph primitives from
                  the merged repository insights work. It still scans manifests for
                  the requested language set, groups vendors into 24 architecture
                  buckets, and persists results in OPFS-backed SQLite WASM.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <MetricPill label="Modes" value="Single + Twin" />
                <MetricPill label="Persistence" value={storageLabel} />
                <MetricPill label="Autocomplete" value="Latest 10 repos" />
              </div>
            </div>

            <TabsList className="mt-5 inline-flex w-fit rounded-full border border-white/10 bg-white/5 p-1">
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

          <TabsContent value="single" className="mt-0 p-3">
            <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
              <div className="space-y-4">
                <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
                        <HugeiconsIcon
                          icon={Github01Icon}
                          className="size-4"
                          strokeWidth={1.8}
                        />
                        Single repo ingest
                      </div>
                      <div className="text-sm text-muted-foreground">
                        GitHub-first, component-scoped auth, contextual repo entry,
                        and repo-native insights.
                      </div>
                    </div>
                    <span className="rounded-full bg-primary/8 px-3 py-1 text-xs font-medium text-primary">
                      shipped now
                    </span>
                  </div>

                  <div className="mt-5 grid gap-4 lg:grid-cols-[0.92fr_1.08fr]">
                    <AuthHud
                      authMode={authMode}
                      onAuthModeChange={setAuthMode}
                      pat={pat}
                      onPatChange={setPat}
                      recentCount={recentRepos.length}
                    />

                    <div className="space-y-3 rounded-2xl border border-border bg-muted/20 p-4">
                      <ContextualTextInput
                        kind="github"
                        value={input}
                        onChange={setInput}
                        disabled={status === "loading"}
                      />

                      <div className="flex flex-wrap items-center gap-2">
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="rounded-full"
                            >
                              <HugeiconsIcon
                                icon={SearchList01Icon}
                                className="size-4"
                                strokeWidth={1.8}
                              />
                              Recent repos
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent
                            align="start"
                            className="w-[340px] rounded-2xl p-2"
                          >
                            <div className="px-2 pb-2 text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase">
                              Most recently committed repos
                            </div>
                            <div className="space-y-1">
                              {(recentRepos.length > 0
                                ? recentRepos
                                : AUTH_SUGGESTIONS.map((fullName, index) => ({
                                    id: index,
                                    fullName: fullName.replace(/^github\.com\//, ""),
                                    owner:
                                      fullName.replace(/^github\.com\//, "").split("/")[0] ?? "",
                                    name:
                                      fullName.replace(/^github\.com\//, "").split("/")[1] ?? "",
                                    description: "Seed suggestion",
                                    pushedAt: new Date().toISOString(),
                                    private: false,
                                    defaultBranch: "main",
                                  }))).map((repo) => (
                                <button
                                  key={`${repo.id}-${repo.fullName}`}
                                  type="button"
                                  className="block w-full rounded-xl px-3 py-2 text-left transition hover:bg-muted"
                                  onClick={() => {
                                    const nextValue = toGithubInputValue(repo.fullName);
                                    setInput(nextValue);
                                    void runScan(nextValue);
                                  }}
                                >
                                  <div className="text-sm font-medium text-foreground">
                                    {repo.fullName}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {repo.description ?? "GitHub repository"}
                                  </div>
                                </button>
                              ))}
                            </div>
                          </PopoverContent>
                        </Popover>

                        <Button
                          type="button"
                          size="sm"
                          className="rounded-full"
                          disabled={status === "loading" || !normalizeRepoCandidate(input)}
                          onClick={() => void runScan()}
                        >
                          Ingest repo
                        </Button>
                      </div>

                      <Suggestions
                        onSelect={(value) => setInput(toGithubInputValue(value))}
                      >
                        <SuggestionList className="justify-start">
                          {(suggestions.length > 0
                            ? suggestions.map((repo) => repo.fullName)
                            : AUTH_SUGGESTIONS.map((repo) =>
                                repo.replace(/^github\.com\//, ""),
                              )
                          ).map((suggestion) => (
                            <Suggestion key={suggestion} value={suggestion}>
                              {suggestion}
                            </Suggestion>
                          ))}
                        </SuggestionList>
                      </Suggestions>

                      <div
                        className={cn(
                          "rounded-xl border px-3 py-2 text-sm",
                          status === "error"
                            ? "border-destructive/30 bg-destructive/10 text-destructive"
                            : "border-border bg-background text-muted-foreground",
                        )}
                      >
                        {statusCopy}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-[0.92fr_1.08fr]">
                  <div className="space-y-4">
                    <RepoCard
                      owner={scan?.repo?.owner.login ?? "vercel"}
                      repo={scan?.repo?.name ?? "next.js"}
                      data={toRepoCardData(scan)}
                      showTopics
                      showUpdated
                    />

                    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-medium text-foreground">
                            Scan telemetry
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Input, manifests, and persisted repo context.
                          </div>
                        </div>
                        {scan ? (
                          <div className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-1 text-[11px] text-emerald-700 dark:text-emerald-300">
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
                        />
                        <MetricPill
                          label="Detected languages"
                          value={
                            scan
                              ? scan.detectedLanguages
                                  .map((language) => language.title)
                                  .join(", ")
                              : "Waiting for scan"
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

                      <div className="mt-4 rounded-xl border border-border bg-muted/30 p-3">
                        <div className="text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase">
                          Language watchlist
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {languageChips.map((language) => (
                            <span
                              key={language.key}
                              className="rounded-full border border-primary/15 bg-primary/8 px-2.5 py-1 text-xs font-medium text-foreground"
                            >
                              {language.rank}. {language.title}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                      <div className="text-sm font-medium text-foreground">
                        Manifest tree
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        Repository manifests discovered during the ingest scan.
                      </div>
                      <div className="mt-4">
                        <FileTree
                          tree={
                            manifestTree.length > 0
                              ? manifestTree
                              : [
                                  {
                                    name: "repo",
                                    children: [{ name: "package.json" }],
                                  },
                                ]
                          }
                          iconStyle="colored"
                          defaultExpanded
                          highlight={highlightPaths}
                        />
                      </div>
                    </div>

                    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                      <div className="text-sm font-medium text-foreground">
                        Repo activity
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        Lightweight contribution tempo for the selected repo.
                      </div>
                      <div className="mt-4">
                        <ActivityGraph data={activityData} weeks={13} />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-foreground">
                        Vendor cloud
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Modules grouped into the 12 frontend and 12 backend
                        architecture buckets.
                      </div>
                    </div>
                    <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] text-muted-foreground">
                      {scan?.repoFullName ?? "no repo yet"}
                    </span>
                  </div>

                  <div className="mt-4 grid gap-4 xl:grid-cols-2">
                    <BucketCloud title="Frontend" groups={frontendBuckets} />
                    <BucketCloud title="Backend" groups={backendBuckets} />
                  </div>

                  {scan?.unmatchedModules.length ? (
                    <div className="mt-4 rounded-2xl border border-border bg-muted/30 p-4">
                      <div className="text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase">
                        Unmatched modules
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {scan.unmatchedModules.slice(0, 18).map((moduleName) => ({
                          displayName: moduleName,
                          icon: getModuleIcon(moduleName),
                          matchKind: "heuristic" as const,
                        })).map((module) => (
                          <VendorChip
                            key={module.displayName}
                            module={module}
                          />
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="space-y-4">
                <StoredScanRail
                  records={storedScans}
                  onRestore={(record) => {
                    setScan(normalizeScanResult(record.result));
                    setInput(toGithubInputValue(record.repoFullName));
                    setStatus("done");
                    setError(null);
                  }}
                />

                <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                  <div className="text-sm font-medium text-foreground">
                    Recent commit graph
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Reuses the merged commit graph component for repo ingest
                    context.
                  </div>
                  <div className="mt-4">
                    {commitData.length > 0 ? (
                      <CommitGraph commits={commitData} />
                    ) : (
                      <div className="rounded-xl border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
                        Scan a repo to populate recent commits.
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                  <div className="text-sm font-medium text-foreground">
                    What this pass ships
                  </div>
                  <ul className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">
                    <li>Contextual GitHub repo entry reusing the new mainline input.</li>
                    <li>Repo-native summary via the merged `repo-card` component.</li>
                    <li>Manifest coverage visualized with the merged `file-tree`.</li>
                    <li>Activity and commit context using the new graph primitives.</li>
                    <li>Local OPFS persistence preserved with SQLite WASM.</li>
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
