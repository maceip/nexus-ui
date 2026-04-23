import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import {
  ArchiveIcon,
  CircleIcon,
  GitForkIcon,
  GithubIcon,
  ScaleIcon,
  StarIcon,
  Clock3Icon,
} from "lucide-react";

import { cn } from "@/lib/utils";

const repoCardVariants = cva(
  "group relative flex h-full w-full flex-col overflow-hidden rounded-[20px] border text-left transition-colors",
  {
    variants: {
      variant: {
        default:
          "border-white/10 bg-[#09090b] text-zinc-50 shadow-[0_0_0_1px_rgba(255,255,255,0.015)] hover:border-white/16",
        outline:
          "border-white/12 bg-[#09090b] text-zinc-50 hover:border-white/18",
        ghost:
          "border-transparent bg-[#09090b] text-zinc-50 hover:border-white/10",
        muted:
          "border-white/10 bg-[#111214] text-zinc-50 hover:border-white/16",
      },
      size: {
        sm: "gap-4 p-4",
        default: "gap-5 p-5",
        lg: "gap-6 p-6",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

const statTextVariants = cva(
  "inline-flex items-center gap-2 text-zinc-300/88",
  {
  variants: {
    size: {
      sm: "text-[12px]",
      default: "text-[13px]",
      lg: "text-[14px]",
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
  const remainingTopics = Math.max((repoData?.topics.length ?? 0) - topics.length, 0);
  const description =
    repoData?.description ?? "GitHub repository preview unavailable.";

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={cn(repoCardVariants({ variant, size }), className)}
    >
      <div className="flex items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/[0.06] ring-1 ring-white/10">
          <GithubIcon className="size-4.5 text-white/80" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <p className="truncate font-semibold text-[15px] text-white tracking-[-0.02em] sm:text-[17px]">
              {repoData?.full_name ?? `${owner}/${repo}`}
            </p>
            {repoData?.archived ? (
              <StatusBadge tone="warning">Archived</StatusBadge>
            ) : null}
            {repoData?.fork ? <StatusBadge tone="default">Fork</StatusBadge> : null}
          </div>
          <p className="truncate text-[12px] text-zinc-500">
            github.com/{repoData?.full_name ?? `${owner}/${repo}`}
          </p>
        </div>
      </div>

      <p className="line-clamp-2 text-[15px] leading-8 text-zinc-300/88 sm:text-[16px] sm:leading-7">
        {description}
      </p>

      {showTopics && (topics.length > 0 || remainingTopics > 0) ? (
        <div className="flex flex-wrap gap-2">
          {topics.map((topic) => (
            <span
              key={topic}
              className="inline-flex items-center rounded-full bg-white/[0.07] px-3 py-1 text-[11px] font-semibold text-zinc-100 ring-1 ring-white/[0.06]"
            >
              {topic}
            </span>
          ))}
          {remainingTopics > 0 ? (
            <span className="inline-flex items-center rounded-full bg-white/[0.07] px-3 py-1 text-[11px] font-semibold text-zinc-300 ring-1 ring-white/[0.06]">
              +{remainingTopics}
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="mt-auto flex flex-wrap items-center gap-x-5 gap-y-2">
        {showLanguage && repoData?.language ? (
          <span className={statTextVariants({ size })}>
            <CircleIcon
              className="size-3.5 fill-current stroke-none"
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
          <span className={cn(statTextVariants({ size }), "ml-auto")}>
            <Clock3Icon className="size-3.5" />
            <span>{formatUpdated(repoData.updated_at)}</span>
          </span>
        ) : null}
      </div>

      {!repoData ? (
        <div className="inline-flex items-center gap-2 rounded-xl border border-dashed border-white/10 bg-white/[0.04] px-3 py-2 text-[12px] text-zinc-400">
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
        "inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em]",
        tone === "warning"
          ? "bg-amber-400/12 text-amber-200 ring-1 ring-amber-300/15"
          : "bg-white/[0.06] text-zinc-300 ring-1 ring-white/[0.08]",
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
  const hour = 1000 * 60 * 60;

  if (diff < hour) return "just now";
  if (diff < day) return "today";
  if (diff < day * 2) return "yesterday";

  return new Intl.RelativeTimeFormat("en", {
    numeric: "auto",
  }).format(-Math.round(diff / day), "day");
}
