"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import PromptInput, {
  PromptInputActions,
  PromptInputAction,
  PromptInputActionGroup,
  PromptInputTextarea,
} from "@/components/nexus-ui/prompt-input";
import {
  GeminiAdd,
  GeminiPageInfo,
  GeminiMic,
  GeminiCaret,
  GeminiSend,
} from "@/components/svgs/gemini-icons";
import { Square } from "lucide-react";
import { cn } from "@/lib/utils";

type InputStatus = "idle" | "loading" | "error" | "submitted";

const GeminiInput = () => {
  const [input, setInput] = React.useState("");
  const [status, setStatus] = React.useState<InputStatus>("idle");

  const doSubmit = React.useCallback((value: string) => {
    if (!value.trim()) return;
    setInput("");
    setStatus("loading");

    setTimeout(() => {
      setStatus("submitted");
      setTimeout(() => setStatus("idle"), 800);
    }, 2500);
  }, []);

  const isLoading = status === "loading";

  return (
    <PromptInput
      onSubmit={doSubmit}
      className="rounded-[32px] p-3 shadow-none dark:border-none"
    >
      <PromptInputTextarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Ask Gemini 3"
        disabled={isLoading}
        className="min-h-12 px-3 py-2.25 text-base! placeholder:text-sm"
      />
      <PromptInputActions className="px-0 pt-2 pb-0">
        <PromptInputActionGroup>
          <PromptInputAction asChild>
            <Button
              type="button"
              className="size-10 cursor-pointer rounded-full border-none bg-transparent text-[13px] leading-6 font-normal text-[#5D5D5D] transition-transform hover:bg-gray-200 active:scale-97 dark:text-white dark:hover:bg-gray-700"
            >
              <GeminiAdd className="size-5 text-[#5D5D5D]" />
            </Button>
          </PromptInputAction>
          <PromptInputAction asChild>
            <Button
              type="button"
              className="h-10 cursor-pointer gap-1.75 rounded-full border-none bg-transparent text-[13px] leading-6 font-normal text-[#5D5D5D] transition-transform hover:bg-gray-200 active:scale-97 dark:text-white dark:hover:bg-gray-700"
            >
              <GeminiPageInfo className="size-5 text-[#5D5D5D]" />
              <span className="max-sm:hidden">Tools</span>
            </Button>
          </PromptInputAction>
        </PromptInputActionGroup>
        <PromptInputActionGroup>
          <PromptInputAction asChild>
            <Button
              type="button"
              className="h-10 cursor-pointer gap-1.75 rounded-full border-none bg-transparent text-[13px] leading-6 font-normal text-[#5D5D5D] transition-transform hover:bg-gray-200 active:scale-97 dark:text-white dark:hover:bg-gray-700"
            >
              <span>Fast</span>
              <GeminiCaret className="-mb-0.5 size-5 text-[#5D5D5D]" />
            </Button>
          </PromptInputAction>
          <PromptInputAction asChild>
            <Button
              type="button"
              className={cn(
                "size-10 cursor-pointer gap-1 rounded-full border-none bg-transparent text-[13px] leading-6 font-normal text-[#5D5D5D] transition-transform hover:bg-gray-200 active:scale-97 disabled:opacity-70 dark:text-white dark:hover:bg-gray-700",
                isLoading && "bg-blue-100 dark:bg-blue-50",
              )}
              disabled={isLoading}
              onClick={() => input.trim() && doSubmit(input)}
            >
              {isLoading ? (
                <Square className="size-3.5 fill-current text-blue-400" />
              ) : input.trim() ? (
                <GeminiSend className="size-5 text-[#5D5D5D]" />
              ) : (
                <GeminiMic className="size-5 text-[#5D5D5D]" />
              )}
            </Button>
          </PromptInputAction>
        </PromptInputActionGroup>
      </PromptInputActions>
    </PromptInput>
  );
};

export default GeminiInput;
