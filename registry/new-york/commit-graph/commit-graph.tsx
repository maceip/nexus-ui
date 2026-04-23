"use client";

import * as React from "react";
import { GitCommitVerticalIcon, TagIcon } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const COMMIT_GRAPH_COLORS = [
  "#2563EB",
  "#7C3AED",
  "#059669",
  "#EA580C",
  "#DB2777",
  "#0891B2",
  "#CA8A04",
  "#4F46E5",
] as const;

const ROW_HEIGHT = 56;
const GRAPH_PADDING_X = 16;
const DOT_RADIUS = 5;

export type Commit = {
  hash: string;
  message: string;
  author: {
    name: string;
    avatarUrl?: string;
  };
  date: string | Date;
  parents: string[];
  refs?: string[];
  tag?: string;
};

export type CommitGraphProps = {
  commits: Commit[];
  truncateHash?: number;
  railWidth?: number;
  className?: string;
};

type CommitLayout = {
  commit: Commit;
  index: number;
  lane: number;
};

type CommitEdge = {
  fromIndex: number;
  toIndex: number;
  fromLane: number;
  toLane: number;
};

export function CommitGraph({
  commits,
  truncateHash = 7,
  railWidth = 18,
  className,
}: CommitGraphProps) {
  const { layouts, edges, maxLane } = React.useMemo(
    () => computeCommitGraphLayout(commits),
    [commits],
  );

  const graphWidth = GRAPH_PADDING_X * 2 + Math.max(1, maxLane + 1) * railWidth;
  const graphHeight = Math.max(commits.length, 1) * ROW_HEIGHT;

  return (
    <div
      data-slot="commit-graph"
      className={cn(
        "relative overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-sm",
        className,
      )}
    >
      <div className="relative min-w-0 overflow-x-auto">
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute top-0 left-0"
          width={graphWidth}
          height={graphHeight}
        >
          {edges.map((edge, index) => {
            const x1 = laneToX(edge.fromLane, railWidth);
            const y1 = rowToY(edge.fromIndex);
            const x2 = laneToX(edge.toLane, railWidth);
            const y2 = rowToY(edge.toIndex);
            const path =
              edge.fromLane === edge.toLane
                ? `M ${x1} ${y1} L ${x2} ${y2}`
                : createCurvedRailPath(x1, y1, x2, y2);

            return (
              <path
                key={`${edge.fromIndex}-${edge.toIndex}-${index}`}
                d={path}
                fill="none"
                stroke={COMMIT_GRAPH_COLORS[edge.fromLane % COMMIT_GRAPH_COLORS.length]}
                strokeWidth="2.25"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.9"
              />
            );
          })}
        </svg>

        <div className="relative">
          {layouts.map((layout) => (
            <CommitRow
              key={layout.commit.hash}
              layout={layout}
              truncateHash={truncateHash}
              graphWidth={graphWidth}
              railWidth={railWidth}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function CommitRow({
  layout,
  truncateHash,
  graphWidth,
  railWidth,
}: {
  layout: CommitLayout;
  truncateHash: number;
  graphWidth: number;
  railWidth: number;
}) {
  const dotColor = COMMIT_GRAPH_COLORS[layout.lane % COMMIT_GRAPH_COLORS.length];
  const date = toDate(layout.commit.date);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-slot="commit-graph-row"
          className="group relative flex w-full min-w-[520px] items-center border-border/70 border-b bg-card text-left last:border-b-0 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          style={{ minHeight: ROW_HEIGHT }}
        >
          <div
            className="relative shrink-0"
            style={{ width: graphWidth, minHeight: ROW_HEIGHT }}
          >
            <div
              className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card shadow-sm"
              style={{
                left: laneToX(layout.lane, railWidth),
                width: DOT_RADIUS * 2.6,
                height: DOT_RADIUS * 2.6,
                backgroundColor: dotColor,
              }}
            />
          </div>

          <div className="flex min-w-0 flex-1 items-center justify-between gap-4 px-4 py-3">
            <div className="min-w-0 space-y-1">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <p className="truncate font-medium text-foreground text-sm">
                  {layout.commit.message}
                </p>
                {layout.commit.refs?.map((ref) => (
                  <RefBadge key={ref}>{ref}</RefBadge>
                ))}
                {layout.commit.tag ? (
                  <RefBadge tone="accent">
                    <TagIcon className="size-3" />
                    {layout.commit.tag}
                  </RefBadge>
                ) : null}
              </div>
              <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground text-xs">
                <span>{layout.commit.author.name}</span>
                <span>{formatDate(date)}</span>
                <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[11px] text-foreground/80">
                  {truncateCommitHash(layout.commit.hash, truncateHash)}
                </code>
              </div>
            </div>
            <GitCommitVerticalIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </div>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[360px] rounded-2xl p-4">
        <div className="space-y-4">
          <div className="space-y-2">
            <p className="font-medium text-base text-foreground">
              {layout.commit.message}
            </p>
            <div className="flex flex-wrap items-center gap-2 text-muted-foreground text-xs">
              <code className="rounded-md bg-muted px-2 py-1 font-mono text-[11px] text-foreground">
                {layout.commit.hash}
              </code>
              {layout.commit.refs?.map((ref) => (
                <RefBadge key={ref}>{ref}</RefBadge>
              ))}
              {layout.commit.tag ? (
                <RefBadge tone="accent">
                  <TagIcon className="size-3" />
                  {layout.commit.tag}
                </RefBadge>
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-muted/30 p-3">
            <Avatar size="lg">
              <AvatarImage src={layout.commit.author.avatarUrl} alt={layout.commit.author.name} />
              <AvatarFallback>
                {layout.commit.author.name.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="font-medium text-sm text-foreground">
                {layout.commit.author.name}
              </p>
              <p className="text-muted-foreground text-xs">
                {formatDate(toDate(layout.commit.date), true)}
              </p>
            </div>
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex items-start justify-between gap-4">
              <span className="text-muted-foreground">Parents</span>
              <div className="flex flex-wrap justify-end gap-2">
                {layout.commit.parents.length > 0 ? (
                  layout.commit.parents.map((parent) => (
                    <code
                      key={parent}
                      className="rounded-md bg-muted px-2 py-1 font-mono text-[11px] text-foreground"
                    >
                      {parent}
                    </code>
                  ))
                ) : (
                  <span className="text-muted-foreground text-xs">Root commit</span>
                )}
              </div>
            </div>
            <div className="flex items-start justify-between gap-4">
              <span className="text-muted-foreground">Topology lane</span>
              <span className="font-medium text-foreground text-xs">
                Rail {layout.lane + 1}
              </span>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function RefBadge({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: "default" | "accent";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
        tone === "accent"
          ? "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-200"
          : "border-border/80 bg-muted/60 text-muted-foreground",
      )}
    >
      {children}
    </span>
  );
}

function computeCommitGraphLayout(commits: Commit[]) {
  const laneByHash = new Map<string, number>();
  const layouts: CommitLayout[] = [];
  const edges: CommitEdge[] = [];

  for (const [index, commit] of commits.entries()) {
    const assignedLane = laneByHash.get(commit.hash);
    const lane = assignedLane ?? firstAvailableLane(laneByHash);

    laneByHash.delete(commit.hash);

    const parentLanes: number[] = [];

    commit.parents.forEach((parentHash, parentIndex) => {
      const parentLane =
        parentIndex === 0
          ? lane
          : laneByHash.get(parentHash) ?? firstAvailableLane(laneByHash, [lane]);

      laneByHash.set(parentHash, parentLane);
      parentLanes.push(parentLane);
    });

    layouts.push({
      commit,
      index,
      lane,
    });

    commit.parents.forEach((parentHash, parentIndex) => {
      const targetIndex = commits.findIndex((item) => item.hash === parentHash);

      if (targetIndex === -1) {
        return;
      }

      edges.push({
        fromIndex: index,
        toIndex: targetIndex,
        fromLane: lane,
        toLane: parentLanes[parentIndex] ?? lane,
      });
    });
  }

  const maxLane = layouts.reduce((accumulator, layout) => {
    return Math.max(accumulator, layout.lane);
  }, 0);

  return {
    layouts,
    edges,
    maxLane,
  };
}

function firstAvailableLane(
  laneByHash: Map<string, number>,
  reserved: number[] = [],
) {
  const used = new Set<number>([...laneByHash.values(), ...reserved]);
  let lane = 0;

  while (used.has(lane)) {
    lane += 1;
  }

  return lane;
}

function laneToX(lane: number, railWidth: number) {
  return GRAPH_PADDING_X + lane * railWidth + railWidth / 2;
}

function rowToY(row: number) {
  return row * ROW_HEIGHT + ROW_HEIGHT / 2;
}

function createCurvedRailPath(x1: number, y1: number, x2: number, y2: number) {
  const midY = y1 + (y2 - y1) / 2;

  return [
    `M ${x1} ${y1}`,
    `L ${x1} ${midY - 6}`,
    `C ${x1} ${midY + 2}, ${x2} ${midY - 2}, ${x2} ${midY + 6}`,
    `L ${x2} ${y2}`,
  ].join(" ");
}

function truncateCommitHash(hash: string, truncateHash: number) {
  return hash.slice(0, truncateHash);
}

function toDate(value: string | Date) {
  return value instanceof Date ? value : new Date(value);
}

function formatDate(date: Date, withTime = false) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    ...(withTime
      ? {
          hour: "numeric",
          minute: "2-digit",
        }
      : {}),
  }).format(date);
}
