"use client";

import {
  Suggestions,
  SuggestionList,
  Suggestion,
} from "@/components/nexus-ui/suggestions";
import { Sparkles, Code, Dumbbell } from "lucide-react";

export default function SuggestionWithIcons() {
  return (
    <Suggestions onSelect={(value) => console.log(value)}>
      <SuggestionList>
        <Suggestion className="gap-1.5">
          <Sparkles className="size-3.5" />
          What is AI?
        </Suggestion>
        <Suggestion className="gap-1.5">
          <Code className="size-3.5" />
          How to learn React?
        </Suggestion>
        <Suggestion className="gap-1.5">
          <Dumbbell className="size-3.5" />
          Design a workout plan
        </Suggestion>
      </SuggestionList>
    </Suggestions>
  );
}
