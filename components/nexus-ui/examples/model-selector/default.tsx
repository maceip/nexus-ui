"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  ModelSelector,
  ModelSelectorContent,
  ModelSelectorGroup,
  ModelSelectorLabel,
  ModelSelectorRadioGroup,
  ModelSelectorRadioItem,
  ModelSelectorTrigger,
} from "@/components/nexus-ui/model-selector";
import { Bot, Sparkles, Zap } from "lucide-react";

const models = [
  {
    value: "gpt-4",
    icon: Sparkles,
    title: "GPT-4",
    description: "Most capable, best for complex tasks",
  },
  {
    value: "gpt-4o-mini",
    icon: Zap,
    title: "GPT-4o Mini",
    description: "Fast and affordable",
  },
  {
    value: "claude",
    icon: Bot,
    title: "Claude 3.5",
    description: "Strong reasoning and analysis",
  },
];

export default function ModelSelectorDefault() {
  const [model, setModel] = React.useState("gpt-4");

  return (
    <ModelSelector value={model} onValueChange={setModel} items={models}>
      <ModelSelectorTrigger asChild>
        <Button variant="outline" className="min-w-[180px] justify-between" />
      </ModelSelectorTrigger>
      <ModelSelectorContent className="">
        <ModelSelectorGroup>
          <ModelSelectorLabel>Select model</ModelSelectorLabel>
          <ModelSelectorRadioGroup value={model} onValueChange={setModel}>
            {models.map((m) => (
              <ModelSelectorRadioItem
                key={m.value}
                value={m.value}
                icon={m.icon}
                title={m.title}
                description={m.description}
              />
            ))}
          </ModelSelectorRadioGroup>
        </ModelSelectorGroup>
      </ModelSelectorContent>
    </ModelSelector>
  );
}
