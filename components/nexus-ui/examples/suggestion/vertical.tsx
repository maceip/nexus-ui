"use client";

import {
  Suggestions,
  SuggestionList,
  Suggestion,
} from "@/components/nexus-ui/suggestions";

export default function SuggestionVertical() {
  return (
    <Suggestions onSelect={(value) => console.log(value)}>
      <SuggestionList orientation="vertical">
        <Suggestion>What is AI?</Suggestion>
        <Suggestion>Teach me Engineering from scratch</Suggestion>
        <Suggestion>Design a weekly workout plan</Suggestion>
      </SuggestionList>
    </Suggestions>
  );
}
