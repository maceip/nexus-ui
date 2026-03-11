"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import PromptInput, {
  PromptInputActions,
  PromptInputAction,
  PromptInputActionGroup,
  PromptInputTextarea,
} from "@/components/nexus-ui/prompt-input";
import {
  Suggestions,
  SuggestionList,
  Suggestion,
} from "@/components/nexus-ui/suggestions";
import { ArrowUp, Paperclip } from "lucide-react";

export default function SuggestionWithPromptInput() {
  const [input, setInput] = useState("");

  return (
    <div className="flex w-full flex-col gap-6">
      <PromptInput>
        <PromptInputTextarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <PromptInputActions>
          <PromptInputActionGroup>
            <PromptInputAction asChild>
              <Button className="size-8 cursor-pointer rounded-full border-none bg-transparent text-gray-900 hover:bg-gray-200 dark:text-white dark:hover:bg-gray-700">
                <Paperclip className="size-4" />
              </Button>
            </PromptInputAction>
          </PromptInputActionGroup>
          <PromptInputActionGroup>
            <PromptInputAction asChild>
              <Button className="size-8 cursor-pointer rounded-full bg-gray-700 text-white hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200">
                <ArrowUp />
              </Button>
            </PromptInputAction>
          </PromptInputActionGroup>
        </PromptInputActions>
      </PromptInput>
      <Suggestions onSelect={(value) => setInput(value)}>
        <SuggestionList className="justify-center">
          <Suggestion>What is AI?</Suggestion>
          <Suggestion>Teach me Engineering from scratch</Suggestion>
          <Suggestion>How to learn React?</Suggestion>
          <Suggestion>Design a weekly workout plan</Suggestion>
          <Suggestion>Places to visit in France</Suggestion>
        </SuggestionList>
      </Suggestions>
    </div>
  );
}
