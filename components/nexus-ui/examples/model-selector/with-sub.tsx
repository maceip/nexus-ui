"use client";

import * as React from "react";
import {
  ModelSelector,
  ModelSelectorContent,
  ModelSelectorGroup,
  ModelSelectorLabel,
  ModelSelectorPortal,
  ModelSelectorRadioGroup,
  ModelSelectorRadioItem,
  ModelSelectorSub,
  ModelSelectorSubContent,
  ModelSelectorSubTrigger,
  ModelSelectorTrigger,
} from "@/components/nexus-ui/model-selector";
import ChatgptIcon from "@/components/svgs/chatgpt";
import { ClaudeIcon2 } from "@/components/svgs/claude";
import V0Icon from "@/components/svgs/v0";

const openaiModels = [
  { value: "gpt-4", icon: ChatgptIcon, title: "GPT-4" },
  { value: "gpt-4o-mini", icon: ChatgptIcon, title: "GPT-4o Mini", disabled: true },
];

const claudeModels = [
  { value: "claude-3.5-sonnet", icon: ClaudeIcon2, title: "Claude 3.5 Sonnet" },
  { value: "claude-3.5-haiku", icon: ClaudeIcon2, title: "Claude 3.5 Haiku" },
];

const v0Models = [
  { value: "v0-auto", icon: V0Icon, title: "v0 Auto" },
  { value: "v0-pro", icon: V0Icon, title: "v0 Pro" },
  { value: "v0-max", icon: V0Icon, title: "v0 Max" },
];

export default function ModelSelectorWithSub() {
  const [model, setModel] = React.useState("gpt-4");

  return (
    <ModelSelector
      value={model}
      onValueChange={setModel}
      items={[...openaiModels, ...claudeModels, ...v0Models]}
    >
      <ModelSelectorTrigger />
      <ModelSelectorContent className="w-[240px]" align="start">
        <ModelSelectorGroup>
          <ModelSelectorLabel>OpenAI</ModelSelectorLabel>
          <ModelSelectorRadioGroup value={model} onValueChange={setModel}>
            {openaiModels.map((m) => (
              <ModelSelectorRadioItem
                key={m.value}
                value={m.value}
                icon={m.icon}
                title={m.title}
                disabled={m.disabled}
              />
            ))}
          </ModelSelectorRadioGroup>
        </ModelSelectorGroup>
        <ModelSelectorGroup>
          <ModelSelectorLabel>Vercel</ModelSelectorLabel>
          <ModelSelectorSub>
            <ModelSelectorSubTrigger>
              <V0Icon className="size-4" />
              v0 Models
            </ModelSelectorSubTrigger>
            <ModelSelectorPortal>
              <ModelSelectorSubContent>
                <ModelSelectorRadioGroup value={model} onValueChange={setModel}>
                  {v0Models.map((m) => (
                    <ModelSelectorRadioItem
                      key={m.value}
                      value={m.value}
                      title={m.title}
                    />
                  ))}
                </ModelSelectorRadioGroup>
              </ModelSelectorSubContent>
            </ModelSelectorPortal>
          </ModelSelectorSub>
        </ModelSelectorGroup>
        <ModelSelectorGroup>
          <ModelSelectorLabel>Anthropic</ModelSelectorLabel>
          <ModelSelectorRadioGroup value={model} onValueChange={setModel}>
            {claudeModels.map((m) => (
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
  );
}
