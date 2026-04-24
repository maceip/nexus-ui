"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

export type ContextualInputKind = "github" | "huggingface";

type ContextualInputConfig = {
  label: string;
  domain: string;
  example: string;
  helper: string;
  patternStyle: React.CSSProperties;
  tintClassName: string;
  accentClassName: string;
  Icon: React.ComponentType<{ className?: string }>;
};

export type ContextualInputValidationResult = {
  normalizedValue: string | null;
  isValid: boolean;
  error: string | null;
};

const contextualInputConfig: Record<
  ContextualInputKind,
  ContextualInputConfig
> = {
  github: {
    label: "GitHub repo",
    domain: "github.com",
    example: "github.com/google/repo",
    helper: "Needs a GitHub repo like github.com/google/repo",
    patternStyle: {
      backgroundImage:
        "linear-gradient(135deg, rgba(148, 163, 184, 0.18) 0px, rgba(148, 163, 184, 0.18) 2px, transparent 2px, transparent 14px)",
      backgroundSize: "18px 18px",
    },
    tintClassName: "bg-slate-100/70 dark:bg-slate-900/30",
    accentClassName:
      "border-slate-200/90 dark:border-slate-700/70 focus-within:border-slate-300 dark:focus-within:border-slate-500",
    Icon: GitHubMarkIcon,
  },
  huggingface: {
    label: "Hugging Face repo",
    domain: "huggingface.co",
    example: "huggingface.co/google/gemma-3-1b",
    helper: "Needs a Hugging Face repo like huggingface.co/google/gemma-3-1b",
    patternStyle: {
      backgroundImage:
        "radial-gradient(circle, rgba(250, 204, 21, 0.32) 1.5px, transparent 1.7px), radial-gradient(circle, rgba(161, 98, 7, 0.18) 1.2px, transparent 1.4px)",
      backgroundSize: "18px 18px",
      backgroundPosition: "0 0, 9px 9px",
    },
    tintClassName: "bg-amber-50/85 dark:bg-amber-950/15",
    accentClassName:
      "border-amber-200/80 dark:border-amber-800/60 focus-within:border-amber-300 dark:focus-within:border-amber-600",
    Icon: HuggingFaceBadgeIcon,
  },
};

function normalizeContextualInputValue(value: string) {
  return value.trim().replace(/^https?:\/\//i, "").replace(/^\/+/, "");
}

export function validateContextualInput(
  kind: ContextualInputKind,
  value: string,
): ContextualInputValidationResult {
  const normalizedValue = normalizeContextualInputValue(value);

  if (!normalizedValue) {
    return {
      normalizedValue: null,
      isValid: true,
      error: null,
    };
  }

  const config = contextualInputConfig[kind];
  const [domain, owner, repo, ...rest] = normalizedValue
    .replace(/\/+$/, "")
    .split("/");

  if (domain?.toLowerCase() !== config.domain) {
    return {
      normalizedValue,
      isValid: false,
      error: `Use the ${config.domain}/owner/repo format.`,
    };
  }

  if (!isRepoSegment(owner) || !isRepoSegment(repo) || rest.length > 0) {
    return {
      normalizedValue,
      isValid: false,
      error: `Enter a full repo like ${config.example}.`,
    };
  }

  return {
    normalizedValue: `${config.domain}/${owner}/${repo}`,
    isValid: true,
    error: null,
  };
}

function isRepoSegment(value: string | undefined) {
  if (!value) return false;
  return /^[a-zA-Z0-9](?:[a-zA-Z0-9._-]{0,98}[a-zA-Z0-9])?$/.test(value);
}

type ContextualTextInputProps = Omit<
  React.ComponentProps<"input">,
  "value" | "onChange"
> & {
  kind: ContextualInputKind;
  value: string;
  onChange: (value: string) => void;
};

export function ContextualTextInput({
  kind,
  value,
  onChange,
  className,
  disabled,
  id,
  ...props
}: ContextualTextInputProps) {
  const config = contextualInputConfig[kind];
  const validation = validateContextualInput(kind, value);
  const showError = value.trim().length > 0 && !validation.isValid;
  const reactId = React.useId();
  const inputId = id ?? reactId;
  const hintId = `${inputId}-hint`;

  return (
    <label
      className={cn(
        "group relative block overflow-hidden rounded-2xl border p-4 shadow-xs transition-colors",
        config.tintClassName,
        config.accentClassName,
        showError && "border-destructive/60 focus-within:border-destructive",
        disabled && "opacity-70",
        className,
      )}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-90"
        style={config.patternStyle}
      />
      <div className="pointer-events-none absolute right-3 top-3 flex size-8 items-center justify-center rounded-full border border-black/5 bg-white/80 text-foreground shadow-xs dark:border-white/10 dark:bg-black/30">
        <config.Icon className="size-4.5" />
      </div>
      <div className="relative space-y-2 pr-10">
        <div className="space-y-1">
          <span className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {config.label}
          </span>
          <input
            id={inputId}
            type="text"
            value={value}
            disabled={disabled}
            aria-invalid={showError}
            aria-describedby={hintId}
            placeholder={config.example}
            className="w-full border-0 bg-transparent pr-2 text-sm text-foreground outline-none placeholder:text-muted-foreground/80"
            onChange={(event) => onChange(event.target.value)}
            {...props}
          />
        </div>
        <p
          id={hintId}
          className={cn(
            "text-xs",
            showError ? "text-destructive" : "text-muted-foreground",
          )}
        >
          {showError ? validation.error : config.helper}
        </p>
      </div>
    </label>
  );
}

function GitHubMarkIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M8 0C3.58 0 0 3.67 0 8.2c0 3.63 2.29 6.71 5.47 7.8.4.08.55-.18.55-.39 0-.19-.01-.82-.01-1.49-2.22.49-2.69-.97-2.69-.97-.36-.95-.89-1.2-.89-1.2-.73-.51.05-.5.05-.5.81.06 1.24.85 1.24.85.72 1.27 1.88.9 2.34.69.07-.54.28-.91.5-1.12-1.77-.21-3.64-.91-3.64-4.07 0-.9.31-1.63.82-2.21-.08-.21-.36-1.06.08-2.22 0 0 .67-.22 2.2.84A7.38 7.38 0 0 1 8 4.78c.68 0 1.37.09 2.01.27 1.53-1.06 2.2-.84 2.2-.84.44 1.16.16 2.01.08 2.22.51.58.82 1.31.82 2.21 0 3.17-1.88 3.85-3.67 4.06.29.26.54.77.54 1.56 0 1.13-.01 2.03-.01 2.31 0 .21.14.48.55.39A8.2 8.2 0 0 0 16 8.2C16 3.67 12.42 0 8 0Z" />
    </svg>
  );
}

function HuggingFaceBadgeIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <circle cx="8" cy="8" r="7" fill="#FACC15" />
      <path
        d="M5.15 6.35a.85.85 0 1 0 0-1.7.85.85 0 0 0 0 1.7ZM10.85 6.35a.85.85 0 1 0 0-1.7.85.85 0 0 0 0 1.7Z"
        fill="#7C4A03"
      />
      <path
        d="M4.6 8.7c.72 1.3 1.92 1.95 3.4 1.95 1.48 0 2.68-.65 3.4-1.95"
        stroke="#7C4A03"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <path
        d="M3.85 7.4c.1-.62.4-1.04.88-1.26m7.42 1.26c-.1-.62-.4-1.04-.88-1.26"
        stroke="#7C4A03"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
    </svg>
  );
}
