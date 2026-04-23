"use client";

import { ActivityGraph } from "@/components/nexus-ui/activity-graph";

const data = Array.from({ length: 365 }, (_, index) => {
  const date = new Date();
  date.setDate(date.getDate() - (364 - index));

  return {
    date: date.toISOString().slice(0, 10),
    count:
      index % 47 === 0
        ? 5
        : index % 53 === 0
          ? 4
          : index % 31 === 0
            ? 3
            : index % 19 === 0
              ? 2
              : index % 13 === 0
                ? 1
                : 0,
  };
});

export default function ActivityGraphDefault() {
  return (
    <div className="flex w-full max-w-5xl flex-col gap-6">
      <div className="space-y-2">
        <p className="font-medium text-foreground text-sm">Heatmap</p>
        <ActivityGraph data={data} weeks={52} className="max-w-5xl" />
      </div>

      <div className="space-y-2">
        <p className="font-medium text-foreground text-sm">Loading mode</p>
        <ActivityGraph
          data={[]}
          weeks={52}
          loading
          loadingSpeed={0.7}
          className="max-w-5xl"
        />
      </div>
    </div>
  );
}
