import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import {
  ArchiveIcon,
  CircleIcon,
  GitForkIcon,
  ScaleIcon,
  StarIcon,
  Clock3Icon,
  ExternalLinkIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

const repoCardVariants = cva(
  "group relative flex h-full w-full flex-col overflow-hidden rounded-2xl border text-left transition-colors",
  {
    variants: {
      variant: {
        default:
          "border-border bg-card text-card-foreground shadow-sm hover:border-foreground/15",
        outline:
          "border-border bg-background text-foreground hover:border-foreground/20",
        ghost:
          "border-transparent bg-transparent text-foreground hover:border-border hover:bg-muted/30",
        muted:
          "border-border/80 bg-muted/50 text-foreground hover:border-foreground/15",
      },
      size: {
        sm: "gap-3 p-4",
        default: "gap-4 p-5",
        lg: "gap-5 p-6",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

const statTextVariants = cva("inline-flex items-center gap-1.5 text-muted-foreground", {
  variants: {
    size: {
      sm: "text-xs",
      default: "text-xs",
      lg: "text-sm",
    },
  },
  defaultVariants: {
    size: "default",
  },
});

export type GitHubRepoData = {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  description: string | null;
  stargazers_count: number;
  forks_count: number;
  language: string | null;
  topics: string[];
  archived: boolean;
  fork: boolean;
  updated_at: string;
  license: {
    key: string | null;
    name: string | null;
    spdx_id?: string | null;
  } | null;
  owner: {
    login: string;
    avatar_url?: string;
    html_url?: string;
  };
};

export type RepoCardProps = VariantProps<typeof repoCardVariants> & {
  owner: string;
  repo: string;
  showLanguage?: boolean;
  showTopics?: boolean;
  showLicense?: boolean;
  showUpdated?: boolean;
  maxTopics?: number;
  data?: GitHubRepoData | null;
  className?: string;
};

const LANGUAGE_COLORS: Record<string, string> = {
  TypeScript: "#3178C6",
  JavaScript: "#F7DF1E",
  TSX: "#3178C6",
  JSX: "#61DAFB",
  HTML: "#E34F26",
  CSS: "#663399",
  SCSS: "#C6538C",
  Rust: "#DEA584",
  Go: "#00ADD8",
  Python: "#3776AB",
  Java: "#B07219",
  Kotlin: "#A97BFF",
  Swift: "#F05138",
  Ruby: "#CC342D",
  PHP: "#777BB4",
  Shell: "#89E051",
  Bash: "#89E051",
  C: "#555555",
  "C++": "#F34B7D",
  "C#": "#239120",
  Dart: "#0175C2",
  Elixir: "#6E4A7E",
  HCL: "#844FBA",
  JSON: "#CBCB41",
  Lua: "#000080",
  MDX: "#1B1F24",
  Markdown: "#083FA1",
  ObjectiveC: "#438EFF",
  Perl: "#0298C3",
  R: "#198CE7",
  Scala: "#C22D40",
  SQL: "#E38C00",
  Svelte: "#FF3E00",
  Vue: "#41B883",
  Zig: "#F7A41D",
};

export async function fetchGitHubRepo(
  owner: string,
  repo: string,
): Promise<GitHubRepoData | null> {
  const token = process.env.GITHUB_TOKEN;
  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
    headers: {
      Accept: "application/vnd.github+json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    next: { revalidate: 3600 },
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as {
    id: number;
    name: string;
    full_name: string;
    html_url: string;
    description: string | null;
    stargazers_count: number;
    forks_count: number;
    language: string | null;
    topics?: string[];
    archived: boolean;
    fork: boolean;
    updated_at: string;
    license: {
      key: string | null;
      name: string | null;
      spdx_id?: string | null;
    } | null;
    owner: {
      login: string;
      avatar_url?: string;
      html_url?: string;
    };
  };

  return {
    id: payload.id,
    name: payload.name,
    full_name: payload.full_name,
    html_url: payload.html_url,
    description: payload.description,
    stargazers_count: payload.stargazers_count,
    forks_count: payload.forks_count,
    language: payload.language,
    topics: payload.topics ?? [],
    archived: payload.archived,
    fork: payload.fork,
    updated_at: payload.updated_at,
    license: payload.license,
    owner: payload.owner,
  };
}

export async function RepoCard({
  owner,
  repo,
  variant = "default",
  size = "default",
  showLanguage = true,
  showTopics = true,
  showLicense = true,
  showUpdated = true,
  maxTopics = 4,
  data,
  className,
}: RepoCardProps) {
  const repoData = data ?? (await fetchGitHubRepo(owner, repo));
  const href = repoData?.html_url ?? `https://github.com/${owner}/${repo}`;
  const languageColor = repoData?.language
    ? LANGUAGE_COLORS[repoData.language] ?? "#9CA3AF"
    : "#9CA3AF";
  const topics = repoData?.topics.slice(0, maxTopics) ?? [];
  const description =
    repoData?.description ?? "GitHub repository preview unavailable.";

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={cn(repoCardVariants({ variant, size }), className)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate font-medium text-foreground text-sm sm:text-base">
              {repoData?.full_name ?? `${owner}/${repo}`}
            </p>
            {repoData?.archived ? (
              <StatusBadge tone="warning">Archived</StatusBadge>
            ) : null}
            {repoData?.fork ? <StatusBadge tone="default">Fork</StatusBadge> : null}
          </div>
          <p className="text-muted-foreground text-xs sm:text-sm">
            by {repoData?.owner.login ?? owner}
          </p>
        </div>
        <ExternalLinkIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
      </div>

      <p className="line-clamp-3 text-muted-foreground text-sm leading-6">
        {description}
      </p>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {showLanguage && repoData?.language ? (
          <span className={statTextVariants({ size })}>
            <CircleIcon
              className="size-3 fill-current stroke-none"
              style={{ color: languageColor }}
            />
            <span>{repoData.language}</span>
          </span>
        ) : null}
        <span className={statTextVariants({ size })}>
          <StarIcon className="size-3.5" />
          <span>{formatCompactNumber(repoData?.stargazers_count ?? 0)}</span>
        </span>
        <span className={statTextVariants({ size })}>
          <GitForkIcon className="size-3.5" />
          <span>{formatCompactNumber(repoData?.forks_count ?? 0)}</span>
        </span>
        {showLicense && repoData?.license?.name ? (
          <span className={statTextVariants({ size })}>
            <ScaleIcon className="size-3.5" />
            <span className="truncate">{repoData.license.spdx_id || repoData.license.name}</span>
          </span>
        ) : null}
        {showUpdated && repoData?.updated_at ? (
          <span className={statTextVariants({ size })}>
            <Clock3Icon className="size-3.5" />
            <span>{formatUpdated(repoData.updated_at)}</span>
          </span>
        ) : null}
      </div>

      {showTopics && topics.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {topics.map((topic) => (
            <span
              key={topic}
              className="inline-flex items-center rounded-full border border-border/80 bg-muted/60 px-2.5 py-1 text-[11px] font-medium text-muted-foreground"
            >
              {topic}
            </span>
          ))}
        </div>
      ) : null}

      {!repoData ? (
        <div className="mt-auto inline-flex items-center gap-2 rounded-xl border border-dashed border-border/80 bg-muted/40 px-3 py-2 text-muted-foreground text-xs">
          <ArchiveIcon className="size-3.5" />
          GitHub API data could not be fetched. Pass `data` to render pre-fetched
          repository details.
        </div>
      ) : null}
    </a>
  );
}

function StatusBadge({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: "default" | "warning";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
        tone === "warning"
          ? "bg-amber-100 text-amber-900 dark:bg-amber-500/15 dark:text-amber-200"
          : "bg-muted text-muted-foreground",
      )}
    >
      {children}
    </span>
  );
}

function formatCompactNumber(value: number) {
  return new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatUpdated(date: string) {
  const updated = new Date(date);
  const diff = Date.now() - updated.getTime();
  const day = 1000 * 60 * 60 * 24;

  if (diff < day) return "Updated today";
  if (diff < day * 2) return "Updated yesterday";

  return `Updated ${new Intl.RelativeTimeFormat("en", {
    numeric: "auto",
  }).format(-Math.round(diff / day), "day")}`;
}
