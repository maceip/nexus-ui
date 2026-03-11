"use client";

import {
  Suggestions,
  SuggestionList,
  Suggestion,
} from "@/components/nexus-ui/suggestions";

export default function SuggestionDefault() {
  return (
    <Suggestions onSelect={(value) => console.log(value)}>
      <SuggestionList className="justify-center max-w-lg">
        <Suggestion>What is AI?</Suggestion>
        <Suggestion>Teach me Engineering from scratch</Suggestion>
        <Suggestion>Design a weekly workout plan</Suggestion>
        <Suggestion>Places to visit in France</Suggestion>
        <Suggestion>How to learn React?</Suggestion>
      </SuggestionList>
    </Suggestions>
  );
}
