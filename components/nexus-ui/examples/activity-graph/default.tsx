"use client";

import { ActivityGraph } from "@/components/nexus-ui/activity-graph";

const data = Array.from({ length: 91 }, (_, index) => {
  const date = new Date();
  date.setDate(date.getDate() - (90 - index));

  return {
    date: date.toISOString().slice(0, 10),
    count: Math.max(0, Math.round((Math.sin(index / 6) + 1) * 3 + (index % 5))),
  };
});

export default function ActivityGraphDefault() {
  return (
    <div className="flex w-full max-w-2xl flex-col gap-6">
      <div className="space-y-2">
        <p className="font-medium text-foreground text-sm">Heatmap</p>
        <ActivityGraph data={data} weeks={13} className="max-w-xl" />
      </div>

      <div className="space-y-2">
        <p className="font-medium text-foreground text-sm">Loading mode</p>
        <ActivityGraph
          data={[]}
          weeks={13}
          loading
          loadingSpeed={0.7}
          className="max-w-xl"
        />
      </div>
    </div>
  );
}
