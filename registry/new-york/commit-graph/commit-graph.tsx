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

const ROW_HEIGHT = 64;
const GRAPH_PADDING_X = 18;
const DOT_RADIUS = 5.5;

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
  railWidth = 22,
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
        "relative overflow-hidden rounded-[22px] border border-white/8 bg-[#0a0a0a] text-white shadow-[0_0_0_1px_rgba(255,255,255,0.02)]",
        className,
      )}
    >
      <div className="relative min-w-0 overflow-x-auto bg-[linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0))]">
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
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.95"
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
          className="group relative flex w-full items-center border-white/6 border-b bg-transparent text-left last:border-b-0 hover:bg-white/[0.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]/60"
          style={{ minHeight: ROW_HEIGHT }}
        >
          <div
            className="relative shrink-0"
            style={{ width: graphWidth, minHeight: ROW_HEIGHT }}
          >
            <div
              className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-[#0a0a0a] shadow-[0_0_0_1px_rgba(255,255,255,0.08)]"
              style={{
                left: laneToX(layout.lane, railWidth),
                width: DOT_RADIUS * 2.6,
                height: DOT_RADIUS * 2.6,
                backgroundColor: dotColor,
              }}
            />
          </div>

          <div className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_120px_44px_140px_116px] items-center gap-4 px-5 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <p className="truncate font-medium text-[16px] text-white tracking-[-0.03em]">
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
            </div>
            <code className="truncate text-right font-mono text-[13px] text-white/45">
              {truncateCommitHash(layout.commit.hash, truncateHash)}
            </code>
            <Avatar size="sm" className="bg-white/6">
              <AvatarImage
                src={layout.commit.author.avatarUrl}
                alt={layout.commit.author.name}
              />
              <AvatarFallback className="bg-white/8 text-[10px] text-white/80">
                {layout.commit.author.name
                  .split(" ")
                  .map((part) => part[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="truncate text-[15px] text-white/72">
              {layout.commit.author.name}
            </div>
            <div className="text-right text-[15px] text-white/52">
              {formatRelativeTime(date)}
            </div>
          </div>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[360px] rounded-2xl border-white/8 bg-[#121212]/95 p-4 text-white shadow-[0_18px_48px_rgba(0,0,0,0.45)] backdrop-blur-xl"
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <p className="font-medium text-base text-white">
              {layout.commit.message}
            </p>
            <div className="flex flex-wrap items-center gap-2 text-white/55 text-xs">
              <code className="rounded-md bg-white/6 px-2 py-1 font-mono text-[11px] text-white/78">
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

          <div className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/[0.03] p-3">
            <Avatar size="lg" className="bg-white/6">
              <AvatarImage
                src={layout.commit.author.avatarUrl}
                alt={layout.commit.author.name}
              />
              <AvatarFallback className="bg-white/8 text-white/85">
                {layout.commit.author.name.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="font-medium text-sm text-white">
                {layout.commit.author.name}
              </p>
              <p className="text-white/52 text-xs">
                {formatDate(toDate(layout.commit.date), true)}
              </p>
            </div>
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex items-start justify-between gap-4">
              <span className="text-white/52">Parents</span>
              <div className="flex flex-wrap justify-end gap-2">
                {layout.commit.parents.length > 0 ? (
                  layout.commit.parents.map((parent) => (
                    <code
                      key={parent}
                      className="rounded-md bg-white/6 px-2 py-1 font-mono text-[11px] text-white/78"
                    >
                      {parent}
                    </code>
                  ))
                ) : (
                  <span className="text-white/45 text-xs">Root commit</span>
                )}
              </div>
            </div>
            <div className="flex items-start justify-between gap-4">
              <span className="text-white/52">Topology lane</span>
              <span className="font-medium text-white/86 text-xs">
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
          ? "border-[#1f4fb7] bg-[#0d2e6e]/40 text-[#5f97ff]"
          : "border-[#1b4fb8] bg-[#0e2448]/40 text-[#4e8bff]",
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

function formatRelativeTime(date: Date) {
  const diff = date.getTime() - Date.now();
  const absHours = Math.abs(diff) / (1000 * 60 * 60);

  if (absHours < 24) {
    return new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(
      Math.round(diff / (1000 * 60 * 60)),
      "hour",
    );
  }

  return new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(
    Math.round(diff / (1000 * 60 * 60 * 24)),
    "day",
  );
}
