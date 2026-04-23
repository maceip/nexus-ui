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
  "rgba(115, 115, 115, 0.14)",
  "#D1FAE5",
  "#86EFAC",
  "#22C55E",
  "#15803D",
];

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
  blockRadius = 4,
  weeks = 26,
  className,
  loading = false,
  loadingSpeed = 1.2,
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

  const effectiveBlockSize = React.useMemo(() => {
    if (blockSize != null) return blockSize;
    if (!containerWidth) return 12;

    const totalGap = (weeks - 1) * 4;
    return Math.max(8, Math.floor((containerWidth - totalGap) / weeks));
  }, [blockSize, containerWidth, weeks]);

  return (
    <TooltipPrimitive.Provider delayDuration={60}>
      <div
        ref={containerRef}
        data-slot="activity-graph"
        className={cn("w-full overflow-hidden", className)}
      >
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
                          "border border-black/5 transition-transform duration-200 hover:scale-105 dark:border-white/5",
                          loading && "will-change-transform",
                        )}
                        style={{
                          width: effectiveBlockSize,
                          height: effectiveBlockSize,
                          borderRadius: blockRadius,
                          backgroundColor: color,
                          opacity: loading ? 0.24 + intensity * 0.16 : 1,
                          transform: loading
                            ? `translateX(${Math.max(0, intensity - 1) * 1.5}px)`
                            : undefined,
                          animation: loading
                            ? `activity-graph-side-scroll ${Math.max(
                                loadingSpeed,
                                0.4,
                              )}s linear infinite`
                            : undefined,
                          animationDelay: loading
                            ? `${(weekIndex * 7 + entry.dayIndex) * 55}ms`
                            : undefined,
                        }}
                      />
                    </TooltipPrimitive.Trigger>
                    <TooltipPrimitive.Portal>
                      <TooltipPrimitive.Content
                        sideOffset={6}
                        className="z-50 rounded-md bg-foreground px-3 py-1.5 text-xs text-background shadow-lg"
                      >
                        <p className="font-medium">
                          {loading
                            ? "Loading activity"
                            : `${entry.count} contribution${
                                entry.count === 1 ? "" : "s"
                              }`}
                        </p>
                        <p className="opacity-80">{formatDate(entry.date)}</p>
                        <TooltipPrimitive.Arrow className="fill-foreground" />
                      </TooltipPrimitive.Content>
                    </TooltipPrimitive.Portal>
                  </TooltipPrimitive.Root>
                );
              })}
            </div>
          ))}
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
  const entries = data.slice(-totalDays).map((entry, index) => ({
    ...entry,
    dayIndex: index % 7,
    loadingLevel: getLoadingLevel(index, loadingSpeed),
  }));

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

function getLoadingLevel(index: number, loadingSpeed: number): 0 | 1 | 2 | 3 | 4 {
  const progress = ((index / 6) * Math.max(loadingSpeed, 0.4)) % 6;
  const wave = Math.abs(Math.sin(progress));
  if (wave < 0.5) return 0;
  if (wave < 0.7) return 1;
  if (wave < 0.82) return 2;
  if (wave < 0.92) return 3;
  return 4;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

export { ActivityGraph };
