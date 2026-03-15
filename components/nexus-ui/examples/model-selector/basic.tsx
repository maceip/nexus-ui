"use client";

import * as React from "react";
import {
  ModelSelector,
  ModelSelectorContent,
  ModelSelectorGroup,
  ModelSelectorRadioGroup,
  ModelSelectorRadioItem,
  ModelSelectorTrigger,
} from "@/components/nexus-ui/model-selector";

const models = [
  { value: "gpt-4", title: "GPT-4" },
  { value: "gpt-4o-mini", title: "GPT-4o Mini" },
  { value: "claude-3.5", title: "Claude 3.5" },
  { value: "gemini-1.5-flash", title: "Gemini 1.5 Flash" },
];

export default function ModelSelectorBasic() {
  const [model, setModel] = React.useState("gpt-4");

  return (
    <ModelSelector value={model} onValueChange={setModel} items={models}>
      <ModelSelectorTrigger />
      <ModelSelectorContent className="w-[200px]" align="start">
        <ModelSelectorGroup>
          <ModelSelectorRadioGroup value={model} onValueChange={setModel}>
            {models.map((m) => (
              <ModelSelectorRadioItem key={m.value} value={m.value} title={m.title} />
            ))}
          </ModelSelectorRadioGroup>
        </ModelSelectorGroup>
      </ModelSelectorContent>
    </ModelSelector>
  );
}
