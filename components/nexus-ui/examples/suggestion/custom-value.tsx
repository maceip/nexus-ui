"use client";

import {
  Suggestions,
  SuggestionList,
  Suggestion,
} from "@/components/nexus-ui/suggestions";

export default function SuggestionCustomValue() {
  return (
    <Suggestions onSelect={(value) => console.log(value)}>
      <SuggestionList>
        <Suggestion value="Explain artificial intelligence in simple terms">
          What is AI?
        </Suggestion>
        <Suggestion value="Create a beginner-friendly React tutorial">
          How to learn React?
        </Suggestion>
      </SuggestionList>
    </Suggestions>
  );
}
