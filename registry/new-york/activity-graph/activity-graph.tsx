"use client";

import * as React from "react";
import { Tooltip as TooltipPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

export type ActivityEntry = {
  date: string;
  count: number;
};

export type GitHubContributions = {
  total: Record<string, number>;
  contributions: ActivityEntry[];
};

export type ActivityGraphProps = {
  data: ActivityEntry[];
  colorScale?: [string, string, string, string, string];
  blockSize?: number;
  blockRadius?: number;
  weeks?: number;
  className?: string;
  loading?: boolean;
  loadingSpeed?: number;
};

const DEFAULT_COLOR_SCALE: [string, string, string, string, string] = [
  "#2a2a2a",
  "#003d2e",
  "#005f46",
  "#00a16d",
  "#00d68f",
];
const DAY_LABELS = ["Mon", "", "Wed", "", "Fri", "", ""];

export async function fetchGitHubContributions(
  username: string,
): Promise<GitHubContributions | null> {
  const response = await fetch(
    `https://github-contributions-api.jogruber.de/v4/${username}`,
    {
      next: { revalidate: 3600 },
    },
  );

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as {
    total?: Record<string, number>;
    contributions?: Array<{
      date: string;
      count: number;
    }>;
  };

  return {
    total: payload.total ?? {},
    contributions:
      payload.contributions?.map((entry) => ({
        date: entry.date,
        count: entry.count,
      })) ?? [],
  };
}

function ActivityGraph({
  data,
  colorScale = DEFAULT_COLOR_SCALE,
  blockSize,
  blockRadius = 2,
  weeks = 52,
  className,
  loading = false,
  loadingSpeed = 1.15,
}: ActivityGraphProps) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = React.useState<number | null>(null);

  React.useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver(([entry]) => {
      setContainerWidth(entry.contentRect.width);
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const paddedData = React.useMemo(
    () => normalizeActivityData(data, weeks),
    [data, weeks],
  );

  const cells = React.useMemo(
    () => buildCells(paddedData, weeks, loading, loadingSpeed),
    [paddedData, weeks, loading, loadingSpeed],
  );
  const monthLabels = React.useMemo(() => buildMonthLabels(cells), [cells]);
  const totalContributions = React.useMemo(
    () => paddedData.reduce((total, entry) => total + entry.count, 0),
    [paddedData],
  );

  const effectiveBlockSize = React.useMemo(() => {
    if (blockSize != null) return blockSize;
    if (!containerWidth) return 13;

    const totalGap = (weeks - 1) * 4;
    return Math.max(8, Math.floor((containerWidth - 38 - totalGap) / weeks));
  }, [blockSize, containerWidth, weeks]);

  return (
    <TooltipPrimitive.Provider delayDuration={60}>
      <div
        ref={containerRef}
        data-slot="activity-graph"
        className={cn(
          "w-full overflow-hidden rounded-2xl bg-[#0b0b0b] px-4 py-3 text-white",
          className,
        )}
      >
        <div className="space-y-3">
          <div className="grid items-end gap-1 pl-10 text-[13px] text-white/55"
            style={{ gridTemplateColumns: `repeat(${weeks}, ${effectiveBlockSize}px)` }}
          >
            {monthLabels.map((label, index) => (
              <div
                key={`${label ?? "empty"}-${index}`}
                className="truncate"
                style={{
                  gridColumn: `${index + 1} / span ${label ? Math.max(1, Math.round(label.span)) : 1}`,
                }}
              >
                {label?.label ?? ""}
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <div className="grid w-7 shrink-0 gap-1 pt-[1px] text-right text-[13px] text-white/72">
              {DAY_LABELS.map((label, index) => (
                <div
                  key={`${label}-${index}`}
                  className="flex items-center justify-end"
                  style={{ height: effectiveBlockSize }}
                >
                  {label}
                </div>
              ))}
            </div>

            <div
              className="grid items-start gap-1"
              style={{
                gridTemplateColumns: `repeat(${weeks}, ${effectiveBlockSize}px)`,
              }}
            >
              {cells.map((week, weekIndex) => (
                <div key={weekIndex} className="grid gap-1">
                  {week.map((entry) => {
                    const intensity = loading
                      ? entry.loadingLevel
                      : getIntensityLevel(entry.count, cells);
                    const color = colorScale[intensity];

                    return (
                      <TooltipPrimitive.Root key={entry.date}>
                        <TooltipPrimitive.Trigger asChild>
                          <div
                            data-slot="activity-graph-cell"
                            className={cn(
                              "border border-white/[0.04] transition-transform duration-200 hover:scale-105",
                              loading && "will-change-transform",
                            )}
                            style={{
                              width: effectiveBlockSize,
                              height: effectiveBlockSize,
                              borderRadius: blockRadius,
                              backgroundColor: color,
                              boxShadow:
                                loading && intensity > 2
                                  ? "0 0 0 1px rgba(0, 214, 143, 0.22), 0 0 12px rgba(0, 214, 143, 0.18)"
                                  : undefined,
                              opacity: loading ? 0.22 + intensity * 0.18 : 1,
                              animation: loading
                                ? `activity-graph-side-scroll ${Math.max(
                                    loadingSpeed,
                                    0.4,
                                  )}s linear infinite`
                                : undefined,
                              animationDelay: loading
                                ? `${weekIndex * 55}ms`
                                : undefined,
                            }}
                          />
                        </TooltipPrimitive.Trigger>
                        <TooltipPrimitive.Portal>
                          <TooltipPrimitive.Content
                            sideOffset={8}
                            className="z-50 rounded-md bg-white px-3 py-1.5 text-xs text-black shadow-xl"
                          >
                            <p className="font-medium">
                              {loading
                                ? "Loading activity"
                                : `${entry.count} contribution${
                                    entry.count === 1 ? "" : "s"
                                  }`}
                            </p>
                            <p className="opacity-70">{formatDate(entry.date)}</p>
                            <TooltipPrimitive.Arrow className="fill-white" />
                          </TooltipPrimitive.Content>
                        </TooltipPrimitive.Portal>
                      </TooltipPrimitive.Root>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 text-[13px] text-white/72">
            <span>{loading ? "Loading" : `${formatCompactNumber(totalContributions)} total`}</span>
            <span className="ml-4">Less</span>
            <div className="flex items-center gap-1">
              {colorScale.map((color) => (
                <span
                  key={color}
                  className="inline-block border border-white/[0.04]"
                  style={{
                    width: effectiveBlockSize,
                    height: effectiveBlockSize,
                    borderRadius: blockRadius,
                    backgroundColor: color,
                  }}
                />
              ))}
            </div>
            <span>More</span>
          </div>
        </div>
      </div>
    </TooltipPrimitive.Provider>
  );
}

type NormalizedEntry = ActivityEntry & {
  dayIndex: number;
  loadingLevel: 0 | 1 | 2 | 3 | 4;
};

function normalizeActivityData(data: ActivityEntry[], weeks: number) {
  const totalDays = weeks * 7;
  const entriesByDate = new Map(
    data.map((entry) => [entry.date, entry.count] satisfies [string, number]),
  );
  const latestDate = data.length > 0 ? new Date(data[data.length - 1].date) : new Date();
  latestDate.setHours(0, 0, 0, 0);

  return Array.from({ length: totalDays }, (_, index) => {
    const date = new Date(latestDate);
    date.setDate(latestDate.getDate() - (totalDays - index - 1));

    const iso = date.toISOString().slice(0, 10);

    return {
      date: iso,
      count: entriesByDate.get(iso) ?? 0,
    };
  });
}

function buildCells(
  data: ActivityEntry[],
  weeks: number,
  loading: boolean,
  loadingSpeed: number,
) {
  const totalDays = weeks * 7;
  const entries = data.slice(-totalDays).map((entry, index) => {
    const dayIndex = index % 7;

    return {
      ...entry,
      dayIndex,
      loadingLevel: getLoadingLevel(Math.floor(index / 7), dayIndex, loadingSpeed),
    };
  });

  return Array.from({ length: weeks }, (_, weekIndex) =>
    entries.slice(weekIndex * 7, weekIndex * 7 + 7),
  );
}

function getIntensityLevel(
  count: number,
  cells: Array<Array<{ count: number }>>,
): 0 | 1 | 2 | 3 | 4 {
  const max = Math.max(0, ...cells.flat().map((entry) => entry.count));
  if (count <= 0 || max <= 0) return 0;

  const ratio = count / max;
  if (ratio <= 0.25) return 1;
  if (ratio <= 0.5) return 2;
  if (ratio <= 0.75) return 3;
  return 4;
}

function getLoadingLevel(
  weekIndex: number,
  dayIndex: number,
  loadingSpeed: number,
): 0 | 1 | 2 | 3 | 4 {
  const phase = weekIndex * 0.55 - dayIndex * 0.16;
  const wave = (Math.sin(phase * Math.max(loadingSpeed, 0.45) + dayIndex * 0.18) + 1) / 2;

  if (wave < 0.56) return 0;
  if (wave < 0.72) return 1;
  if (wave < 0.84) return 2;
  if (wave < 0.93) return 3;
  return 4;
}

function buildMonthLabels(cells: NormalizedEntry[][]) {
  const labels: Array<{ label: string; span: number } | null> = Array.from(
    { length: cells.length },
    () => null,
  );

  let previousMonth: string | null = null;

  cells.forEach((week, index) => {
    const firstDate = new Date(week[0]?.date ?? "");
    const label = new Intl.DateTimeFormat("en", { month: "short" }).format(firstDate);

    if (label !== previousMonth) {
      labels[index] = { label, span: 1 };
      previousMonth = label;
      return;
    }

    const previous = labels
      .slice(0, index)
      .reverse()
      .find((entry): entry is { label: string; span: number } => entry != null);

    if (previous) {
      previous.span += 1;
    }
  });

  return labels;
}

function formatCompactNumber(value: number) {
  return new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

export { ActivityGraph };
