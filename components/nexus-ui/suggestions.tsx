"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type SuggestionsContextValue = {
  onSelect?: (value: string) => void;
};

const SuggestionsContext = React.createContext<SuggestionsContextValue>({});

type SuggestionsProps = Omit<React.HTMLAttributes<HTMLDivElement>, "onSelect"> & {
  onSelect?: (value: string) => void;
};

const Suggestions = React.forwardRef<HTMLDivElement, SuggestionsProps>(
  ({ className, onSelect, ...props }, ref) => (
    <SuggestionsContext value={{ onSelect }}>
      <div ref={ref} className={cn("flex flex-col gap-2", className)} {...props} />
    </SuggestionsContext>
  ),
);

Suggestions.displayName = "Suggestions";

type SuggestionListProps = React.HTMLAttributes<HTMLDivElement> & {
  orientation?: "horizontal" | "vertical";
};

const SuggestionList = React.forwardRef<HTMLDivElement, SuggestionListProps>(
  ({ className, orientation = "horizontal", ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "flex gap-2",
        orientation === "horizontal"
          ? "flex-row flex-wrap items-center"
          : "flex-col items-start",
        className,
      )}
      role="group"
      {...props}
    />
  ),
);

SuggestionList.displayName = "SuggestionList";

type SuggestionProps = React.ComponentProps<typeof Button> & {
  value?: string;
};

const Suggestion = React.forwardRef<HTMLButtonElement, SuggestionProps>(
  ({ className, value, onClick, children, ...props }, ref) => {
    const { onSelect } = React.useContext(SuggestionsContext);

    return (
      <Button
        ref={ref}
        className={cn(
          "h-8 rounded-full border-none bg-gray-100 px-4 text-sm font-normal text-gray-900 shadow-none outline-none hover:bg-gray-200 focus-visible:ring-0 dark:bg-white/10 dark:text-gray-100 dark:hover:bg-white/15",
          className,
        )}
        onClick={(e) => {
          onClick?.(e);
          const text = value ?? (typeof children === "string" ? children : "");
          if (text && onSelect) onSelect(text);
        }}
        {...props}
      >
        {children}
      </Button>
    );
  },
);

Suggestion.displayName = "Suggestion";

export { Suggestions, SuggestionList, Suggestion };

export default Suggestions;
