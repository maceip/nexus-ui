"use client";

import * as React from "react";
import {
  ModelSelector,
  ModelSelectorContent,
  ModelSelectorGroup,
  ModelSelectorLabel,
  ModelSelectorRadioGroup,
  ModelSelectorRadioItem,
  ModelSelectorTrigger,
} from "@/components/nexus-ui/model-selector";
import ChatgptIcon from "@/components/svgs/chatgpt";
import { ClaudeIcon2 } from "@/components/svgs/claude";
import GeminiIcon from "@/components/svgs/gemini";

const models = [
  { value: "gpt-4", icon: ChatgptIcon, title: "GPT-4" },
  { value: "claude-3.5", icon: ClaudeIcon2, title: "Claude 3.5" },
  { value: "gemini-1.5-flash", icon: GeminiIcon, title: "Gemini 1.5 Flash" },
];

export default function ModelSelectorTriggerVariants() {
  const [filled, setFilled] = React.useState("gpt-4");
  const [outline, setOutline] = React.useState("claude-3.5");
  const [ghost, setGhost] = React.useState("gemini-1.5-flash");

  return (
    <div className="flex flex-wrap items-center gap-4">
      <ModelSelector value={filled} onValueChange={setFilled} items={models}>
        <ModelSelectorTrigger variant="filled" />
        <ModelSelectorContent className="w-[220px]" align="start">
          <ModelSelectorGroup>
            <ModelSelectorLabel>Filled (default)</ModelSelectorLabel>
            <ModelSelectorRadioGroup value={filled} onValueChange={setFilled}>
              {models.map((m) => (
                <ModelSelectorRadioItem
                  key={m.value}
                  value={m.value}
                  icon={m.icon}
                  title={m.title}
                />
              ))}
            </ModelSelectorRadioGroup>
          </ModelSelectorGroup>
        </ModelSelectorContent>
      </ModelSelector>

      <ModelSelector value={outline} onValueChange={setOutline} items={models}>
        <ModelSelectorTrigger variant="outline" />
        <ModelSelectorContent className="w-[220px]" align="start">
          <ModelSelectorGroup>
            <ModelSelectorLabel>Outline</ModelSelectorLabel>
            <ModelSelectorRadioGroup value={outline} onValueChange={setOutline}>
              {models.map((m) => (
                <ModelSelectorRadioItem
                  key={m.value}
                  value={m.value}
                  icon={m.icon}
                  title={m.title}
                />
              ))}
            </ModelSelectorRadioGroup>
          </ModelSelectorGroup>
        </ModelSelectorContent>
      </ModelSelector>

      <ModelSelector value={ghost} onValueChange={setGhost} items={models}>
        <ModelSelectorTrigger variant="ghost" />
        <ModelSelectorContent className="w-[220px]" align="start">
          <ModelSelectorGroup>
            <ModelSelectorLabel>Ghost</ModelSelectorLabel>
            <ModelSelectorRadioGroup value={ghost} onValueChange={setGhost}>
              {models.map((m) => (
                <ModelSelectorRadioItem
                  key={m.value}
                  value={m.value}
                  icon={m.icon}
                  title={m.title}
                />
              ))}
            </ModelSelectorRadioGroup>
          </ModelSelectorGroup>
        </ModelSelectorContent>
      </ModelSelector>
    </div>
  );
}
