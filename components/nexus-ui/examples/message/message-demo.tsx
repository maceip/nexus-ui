"use client";

import * as React from "react";
import { useChat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  isTextUIPart,
  type UIMessage,
} from "ai";
import { motion } from "motion/react";
import {
  ContextualTextInput,
  type ContextualInputKind,
  validateContextualInput,
} from "@/components/nexus-ui/contextual-text-input";
import {
  FoundationBlueprint,
  FoundationConstellation,
  FoundationDock,
  FoundationRail,
  FOUNDATION_STACKS,
  type FoundationLayerStyle,
  type FoundationIconToken,
  type FoundationStackId,
} from "@/components/nexus-ui/foundation-layers";
import { Button } from "@/components/ui/button";
import {
  Message,
  MessageAction,
  MessageActionGroup,
  MessageActions,
  MessageAvatar,
  MessageContent,
  MessageMarkdown,
  MessageStack,
} from "@/components/nexus-ui/message";
import {
  Thread,
  ThreadContent,
  ThreadScrollToBottom,
} from "@/components/nexus-ui/thread";
import PromptInput, {
  PromptInputAction,
  PromptInputActionGroup,
  PromptInputActions,
  PromptInputTextarea,
} from "@/components/nexus-ui/prompt-input";
import { TypingLoader } from "@/components/nexus-ui/loader";
import ChatgptIcon from "@/components/svgs/chatgpt";
import { ClaudeIcon2 } from "@/components/svgs/claude";
import GeminiIcon from "@/components/svgs/gemini";
import V0Icon from "@/components/svgs/v0";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  ArrowDown01Icon,
  ArrowUp02Icon,
  Copy01Icon,
  Edit04Icon,
  Link01Icon,
  RepeatIcon,
  SquareIcon,
  Tick02Icon,
  ThumbsDownIcon,
  ThumbsUpIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

const imgUser = "/assets/user-avatar.avif";
const imgAssistant = "/assets/nexus-avatar.png";

type ProviderKey = "claude" | "v0" | "gemini" | "chatgpt";

const foundationLayerStyles = [
  "dock",
  "rail",
  "constellation",
  "blueprint",
] as const satisfies readonly FoundationLayerStyle[];

const foundationLayerLabels: Record<FoundationLayerStyle, string> = {
  dock: "Dock",
  rail: "Rail",
  constellation: "Constellation",
  blueprint: "Blueprint",
};

type ProviderModel = {
  value: string;
  title: string;
  description: string;
};

type ProviderTool = {
  id: string;
  label: string;
  description: string;
};

type ProviderDefinition = {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  promptPlaceholder: string;
  description: string;
  models: ProviderModel[];
  tools: ProviderTool[];
  defaultTools: string[];
};

const providers: Record<ProviderKey, ProviderDefinition> = {
  claude: {
    label: "Claude",
    icon: ClaudeIcon2,
    promptPlaceholder: "Ask Claude about the app...",
    description: "Reasoning-first workflows",
    models: [
      {
        value: "anthropic/claude-sonnet-4.5",
        title: "Sonnet 4.5",
        description: "Balanced reasoning and coding",
      },
      {
        value: "anthropic/claude-haiku-4.5",
        title: "Haiku 4.5",
        description: "Faster responses for iteration",
      },
    ],
    tools: [
      {
        id: "analysis",
        label: "Analysis",
        description: "Favor deeper reasoning before answering",
      },
      {
        id: "artifacts",
        label: "Artifacts",
        description: "Prefer diff-ready implementation details",
      },
    ],
    defaultTools: ["analysis"],
  },
  v0: {
    label: "v0",
    icon: V0Icon,
    promptPlaceholder: "Ask v0 to build the next screen...",
    description: "UI generation and iteration",
    models: [
      {
        value: "vercel/v0-1.5-md",
        title: "v0 1.5 MD",
        description: "Latest general UI model",
      },
      {
        value: "vercel/v0-1.0-md",
        title: "v0 1.0 MD",
        description: "Legacy layout-focused model",
      },
    ],
    tools: [
      {
        id: "codegen",
        label: "Code generation",
        description: "Prefer concrete component output",
      },
      {
        id: "polish",
        label: "UI polish",
        description: "Bias toward spacing, layout, and details",
      },
    ],
    defaultTools: ["codegen"],
  },
  gemini: {
    label: "Gemini",
    icon: GeminiIcon,
    promptPlaceholder: "Ask Gemini with the current repo context...",
    description: "Fast multimodal workflows",
    models: [
      {
        value: "google/gemini-3-flash",
        title: "Gemini 3 Flash",
        description: "Fastest general Gemini option",
      },
      {
        value: "google/gemini-2.5-flash",
        title: "Gemini 2.5 Flash",
        description: "Balanced speed and reasoning",
      },
    ],
    tools: [
      {
        id: "grounding",
        label: "Grounding",
        description: "Prefer structured, evidence-based answers",
      },
      {
        id: "files",
        label: "File context",
        description: "Lean on supplied repo and model references",
      },
    ],
    defaultTools: ["grounding"],
  },
  chatgpt: {
    label: "ChatGPT",
    icon: ChatgptIcon,
    promptPlaceholder: "Ask ChatGPT anything about the implementation...",
    description: "General chat and drafting",
    models: [
      {
        value: "openai/gpt-4o",
        title: "GPT-4o",
        description: "Most capable general model",
      },
      {
        value: "openai/gpt-4o-mini",
        title: "GPT-4o Mini",
        description: "Faster and lighter for quick turns",
      },
    ],
    tools: [
      {
        id: "search",
        label: "Search",
        description: "Favor web-style summaries and citations",
      },
      {
        id: "canvas",
        label: "Canvas",
        description: "Prefer structured plans and revisions",
      },
    ],
    defaultTools: ["search"],
  },
};

const contextualKinds: ContextualInputKind[] = ["github", "huggingface"];

function textFromMessage(message: UIMessage) {
  return message.parts.filter(isTextUIPart).map((p) => p.text).join("");
}

function isAssistantTextStreaming(message: UIMessage) {
  return message.parts
    .filter(isTextUIPart)
    .some((p) => p.state === "streaming");
}

function sourceUrlPartsFromMessage(message: UIMessage) {
  return message.parts.filter(
    (p): p is Extract<UIMessage["parts"][number], { type: "source-url" }> =>
      p.type === "source-url",
  );
}

export default function MessageDemo() {
  const copyMessage = React.useCallback((text: string) => {
    void navigator.clipboard?.writeText(text);
  }, []);

  const [provider, setProvider] = React.useState<ProviderKey>("claude");
  const [foundationStyle, setFoundationStyle] =
    React.useState<FoundationLayerStyle>("dock");
  const [foundationStack, setFoundationStack] =
    React.useState<FoundationStackId>("aws-arbitrage");
  const [activeFoundationIcon, setActiveFoundationIcon] =
    React.useState<FoundationIconToken>("amazon-bedrock");
  const [providerState, setProviderState] = React.useState(() => ({
    claude: {
      model: providers.claude.models[0].value,
      tools: providers.claude.defaultTools,
    },
    v0: {
      model: providers.v0.models[0].value,
      tools: providers.v0.defaultTools,
    },
    gemini: {
      model: providers.gemini.models[0].value,
      tools: providers.gemini.defaultTools,
    },
    chatgpt: {
      model: providers.chatgpt.models[0].value,
      tools: providers.chatgpt.defaultTools,
    },
  }));
  const [githubRepo, setGithubRepo] = React.useState("");
  const [huggingfaceRepo, setHuggingfaceRepo] = React.useState("");
  const [contextError, setContextError] = React.useState<string | null>(null);

  const providerRef = React.useRef(provider);
  providerRef.current = provider;
  const providerStateRef = React.useRef(providerState);
  providerStateRef.current = providerState;

  const githubValidation = React.useMemo(
    () => validateContextualInput("github", githubRepo),
    [githubRepo],
  );
  const huggingfaceValidation = React.useMemo(
    () => validateContextualInput("huggingface", huggingfaceRepo),
    [huggingfaceRepo],
  );
  const githubValidationRef = React.useRef(githubValidation);
  githubValidationRef.current = githubValidation;
  const huggingfaceValidationRef = React.useRef(huggingfaceValidation);
  huggingfaceValidationRef.current = huggingfaceValidation;

  const transport = React.useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: () => {
          const activeProvider = providerRef.current;
          const activeProviderState = providerStateRef.current[activeProvider];

          return {
            provider: activeProvider,
            model: activeProviderState.model,
            tools: activeProviderState.tools,
            contexts: {
              github:
                githubValidationRef.current.normalizedValue ?? undefined,
              huggingface:
                huggingfaceValidationRef.current.normalizedValue ?? undefined,
            },
          };
        },
      }),
    [],
  );

  const { messages, sendMessage, status, stop, regenerate, error, clearError } =
    useChat({ transport });

  const [input, setInput] = React.useState("");

  const busy = status === "streaming" || status === "submitted";
  const hasInvalidContext = React.useMemo(
    () =>
      contextualKinds.some((kind) => {
        const validation =
          kind === "github" ? githubValidation : huggingfaceValidation;
        const sourceValue = kind === "github" ? githubRepo : huggingfaceRepo;
        return sourceValue.trim().length > 0 && !validation.isValid;
      }),
    [githubRepo, githubValidation, huggingfaceRepo, huggingfaceValidation],
  );

  const visibleMessages = React.useMemo(
    () => messages.filter((m) => m.role !== "system"),
    [messages],
  );

  const lastMessage = visibleMessages[visibleMessages.length - 1];

  const showPendingAssistantRow =
    status === "submitted" && lastMessage?.role === "user";

  const activeProvider = providers[provider];
  const activeProviderState = providerState[provider];
  const activeFoundationStack = FOUNDATION_STACKS.find(
    (stack) => stack.id === foundationStack,
  )!;

  const FoundationLayerComponent = React.useMemo(() => {
    switch (foundationStyle) {
      case "blueprint":
        return FoundationBlueprint;
      case "rail":
        return FoundationRail;
      case "constellation":
        return FoundationConstellation;
      default:
        return FoundationDock;
    }
  }, [foundationStyle]);
  const activeContextChips = React.useMemo(
    () =>
      [
        githubValidation.normalizedValue,
        huggingfaceValidation.normalizedValue,
      ].filter((value): value is string => Boolean(value)),
    [githubValidation.normalizedValue, huggingfaceValidation.normalizedValue],
  );

  React.useEffect(() => {
    if (!hasInvalidContext) {
      setContextError(null);
    }
  }, [hasInvalidContext]);

  const handleSubmit = React.useCallback(
    async (value: string) => {
      const trimmed = value.trim();
      if (!trimmed || busy) return;
      if (hasInvalidContext) {
        setContextError("Fix the contextual repo fields before sending.");
        return;
      }
      setContextError(null);
      setInput("");
      await sendMessage({ text: trimmed });
    },
    [busy, hasInvalidContext, sendMessage],
  );

  const updateProviderModel = React.useCallback(
    (nextModel: string) => {
      setProviderState((current) => ({
        ...current,
        [provider]: {
          ...current[provider],
          model: nextModel,
        },
      }));
    },
    [provider],
  );

  const toggleProviderTool = React.useCallback(
    (toolId: string) => {
      setProviderState((current) => {
        const currentTools = current[provider].tools;
        const nextTools = currentTools.includes(toolId)
          ? currentTools.filter((item) => item !== toolId)
          : [...currentTools, toolId];

        return {
          ...current,
          [provider]: {
            ...current[provider],
            tools: nextTools,
          },
        };
      });
    },
    [provider],
  );

  return (
    <div className="relative flex h-screen items-start px-0 lg:px-10 pt-5 lg:pt-20">
      <Thread className="h-[75vh]">
        <ThreadContent className="mx-auto max-w-3xl pb-64">
          {visibleMessages.map((m) => {
            const from = m.role === "user" ? "user" : "assistant";
            const text = textFromMessage(m);
            const isLast = m.id === lastMessage?.id;
            const showInlineAssistantLoader =
              m.role === "assistant" &&
              text === "" &&
              isLast &&
              status === "streaming";
            const sourceUrls = sourceUrlPartsFromMessage(m);

            return (
              <motion.div
                key={m.id}
                className="w-full"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{
                  duration: 0.3,
                  ease: [0.25, 0.1, 0.25, 1],
                  delay: from === "assistant" ? 0.14 : 0,
                }}
              >
                <Message from={from}>
                  {from === "assistant" ? (
                    <MessageAvatar src={imgAssistant} alt="" fallback="A" />
                  ) : null}
                  {from === "assistant" && showInlineAssistantLoader ? (
                    <div className="flex min-h-7 min-w-0 flex-1 items-center px-2 pt-1">
                      <TypingLoader size="md" />
                    </div>
                  ) : from === "assistant" ? (
                    <motion.div
                      className="flex min-w-0 flex-1 flex-col"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{
                        duration: 0.3,
                        delay: 0,
                        ease: [0.25, 0.1, 0.25, 1],
                      }}
                    >
                      <MessageStack>
                        <MessageContent>
                          <MessageMarkdown
                            isAnimating={isAssistantTextStreaming(m)}
                          >
                            {text}
                          </MessageMarkdown>
                          {sourceUrls.length > 0 ? (
                            <div className="mt-4 border-t border-border pt-3">
                              <p className="mb-2 flex items-center gap-1.5 text-muted-foreground text-xs font-medium tracking-wide uppercase dark:text-white/70">
                                <HugeiconsIcon
                                  icon={Link01Icon}
                                  strokeWidth={2}
                                  className="size-3.5"
                                />
                                Sources
                              </p>
                              <ul className="flex max-h-48 flex-col gap-1.5 overflow-y-auto text-sm">
                                {sourceUrls.map((s) => (
                                  <li key={s.sourceId} className="min-w-0">
                                    <a
                                      href={s.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-primary underline decoration-primary/30 underline-offset-2 transition-colors hover:decoration-primary"
                                    >
                                      {s.title?.trim() || s.url}
                                    </a>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ) : null}
                        </MessageContent>
                        {!isAssistantTextStreaming(m) && text.length > 0 ? (
                          <MessageActions>
                            <MessageActionGroup>
                              <MessageAction asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-sm"
                                  className="cursor-pointer rounded-full bg-transparent text-muted-foreground transition-all hover:bg-muted active:scale-97 dark:text-white dark:hover:bg-border"
                                  aria-label="Copy message"
                                  onClick={() => copyMessage(text)}
                                >
                                  <HugeiconsIcon
                                    icon={Copy01Icon}
                                    strokeWidth={2.0}
                                    className="size-4"
                                  />
                                </Button>
                              </MessageAction>
                              <MessageAction asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-sm"
                                  className="cursor-pointer rounded-full bg-transparent text-muted-foreground transition-all hover:bg-muted active:scale-97 dark:text-white dark:hover:bg-border"
                                  aria-label="Good response"
                                >
                                  <HugeiconsIcon
                                    icon={ThumbsUpIcon}
                                    strokeWidth={2.0}
                                    className="size-4"
                                  />
                                </Button>
                              </MessageAction>
                              <MessageAction asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-sm"
                                  className="cursor-pointer rounded-full bg-transparent text-muted-foreground transition-all hover:bg-muted active:scale-97 dark:text-white dark:hover:bg-border"
                                  aria-label="Bad response"
                                >
                                  <HugeiconsIcon
                                    icon={ThumbsDownIcon}
                                    strokeWidth={2.0}
                                    className="size-4"
                                  />
                                </Button>
                              </MessageAction>
                              <MessageAction asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-sm"
                                  className="cursor-pointer rounded-full bg-transparent text-muted-foreground transition-all hover:bg-muted active:scale-97 dark:text-white dark:hover:bg-border"
                                  aria-label="Regenerate"
                                  disabled={busy}
                                  onClick={() => void regenerate({ messageId: m.id })}
                                >
                                  <HugeiconsIcon
                                    icon={RepeatIcon}
                                    strokeWidth={2.0}
                                    className="size-4"
                                  />
                                </Button>
                              </MessageAction>
                            </MessageActionGroup>
                          </MessageActions>
                        ) : null}
                      </MessageStack>
                    </motion.div>
                  ) : (
                    <MessageStack>
                      <MessageContent>
                        <MessageMarkdown>{text}</MessageMarkdown>
                      </MessageContent>
                      <MessageActions>
                        <MessageActionGroup>
                          <MessageAction asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              className="cursor-pointer rounded-full bg-transparent text-muted-foreground transition-all hover:bg-muted active:scale-97 dark:text-white dark:hover:bg-border"
                              aria-label="Edit message"
                            >
                              <HugeiconsIcon
                                icon={Edit04Icon}
                                strokeWidth={2.0}
                                className="size-4"
                              />
                            </Button>
                          </MessageAction>
                          <MessageAction asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              className="cursor-pointer rounded-full bg-transparent text-muted-foreground transition-all hover:bg-muted active:scale-97 dark:text-white dark:hover:bg-border"
                              aria-label="Copy message"
                              onClick={() => copyMessage(text)}
                            >
                              <HugeiconsIcon
                                icon={Copy01Icon}
                                strokeWidth={2.0}
                                className="size-4"
                              />
                            </Button>
                          </MessageAction>
                        </MessageActionGroup>
                      </MessageActions>
                    </MessageStack>
                  )}
                  {from === "user" ? (
                    <MessageAvatar src={imgUser} alt="" fallback="U" />
                  ) : null}
                </Message>
              </motion.div>
            );
          })}
          {showPendingAssistantRow ? (
            <motion.div
              key="assistant-pending"
              className="w-full"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{
                duration: 0.3,
                ease: [0.25, 0.1, 0.25, 1],
                delay: 0.14,
              }}
            >
              <Message from="assistant">
                <MessageAvatar src={imgAssistant} alt="" fallback="A" />
                <div className="flex min-h-7 min-w-0 flex-1 items-center px-2 pt-1">
                  <TypingLoader size="md" />
                </div>
              </Message>
            </motion.div>
          ) : null}
        </ThreadContent>
        <ThreadScrollToBottom className="bottom-0 z-50" />
      </Thread>

      <div className="fixed right-0 bottom-0 left-0 z-10 flex w-full items-center justify-center border-t border-accent bg-background/70 px-6 pt-6 pb-12 backdrop-blur-sm dark:bg-background/95">
        <div className="mx-auto w-full max-w-3xl space-y-2">
          {error || contextError ? (
            <div
              role="alert"
              className="flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              <span className="min-w-0 flex-1">
                {contextError ?? error?.message}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="shrink-0"
                onClick={() => {
                  setContextError(null);
                  clearError();
                }}
              >
                Dismiss
              </Button>
            </div>
          ) : null}
          <div className="rounded-[24px] border border-border/70 bg-card/90 p-2 shadow-sm">
            <FoundationLayerComponent
              stackId={foundationStack}
              onStackChange={setFoundationStack}
              activeIcon={activeFoundationIcon}
              onActiveIconChange={setActiveFoundationIcon}
              defaultCollapsed
              className="w-full"
            />
          </div>
          <PromptInput
            onSubmit={(v) => void handleSubmit(v)}
            className="gap-3 rounded-[28px] border-border/70 bg-card/95 p-3 shadow-lg dark:bg-background/95"
          >
            <div className="grid gap-2 sm:grid-cols-2">
              <ContextualTextInput
                kind="github"
                value={githubRepo}
                onChange={setGithubRepo}
                disabled={busy}
              />
              <ContextualTextInput
                kind="huggingface"
                value={huggingfaceRepo}
                onChange={setHuggingfaceRepo}
                disabled={busy}
              />
            </div>
            <PromptInputTextarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={activeProvider.promptPlaceholder}
              disabled={busy}
              className="min-h-18 px-4 py-4 text-sm"
            />
            {activeContextChips.length > 0 ? (
              <div className="-mt-1 flex flex-wrap gap-2 px-2">
                {activeContextChips.map((chip) => (
                  <div
                    key={chip}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-muted/60 px-2.5 py-1 text-xs text-muted-foreground"
                  >
                    <HugeiconsIcon
                      icon={Link01Icon}
                      strokeWidth={2}
                      className="size-3.5"
                    />
                    <span>{chip}</span>
                  </div>
                ))}
              </div>
            ) : null}
            <PromptInputActions>
              <PromptInputActionGroup>
                <PromptInputAction asChild>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-9 rounded-full border-border/80 bg-background/80 px-3 text-sm shadow-xs hover:bg-muted/80 dark:bg-background/60"
                        disabled={busy}
                        aria-label="Open provider settings"
                      >
                        <activeProvider.icon className="size-4 shrink-0" />
                        <span>{activeProvider.label}</span>
                        <HugeiconsIcon
                          icon={ArrowDown01Icon}
                          strokeWidth={2}
                          className="size-4 shrink-0 opacity-70"
                        />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      align="start"
                      className="w-[360px] rounded-2xl border-border/70 bg-popover/95 p-4 shadow-modal"
                    >
                      <div className="space-y-4">
                        <div className="space-y-1">
                          <p className="text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase">
                            Foundation layer
                          </p>
                          <div className="grid grid-cols-2 gap-2">
                            {FOUNDATION_STACKS.map((stack) => (
                              <button
                                key={stack.id}
                                type="button"
                                onClick={() => setFoundationStack(stack.id)}
                                className={`rounded-xl border px-3 py-2 text-left transition-colors ${
                                  foundationStack === stack.id
                                    ? "border-foreground/20 bg-muted text-foreground"
                                    : "border-border/70 bg-background text-muted-foreground hover:bg-muted/70"
                                }`}
                              >
                                <span className="block text-sm font-medium">
                                  {stack.label}
                                </span>
                                <span className="mt-1 block text-xs">
                                  {stack.bestFor}
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-1">
                          <p className="text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase">
                            Foundation style
                          </p>
                          <div className="grid grid-cols-2 gap-2">
                            {foundationLayerStyles.map((style) => (
                              <button
                                key={style}
                                type="button"
                                onClick={() => setFoundationStyle(style)}
                                className={`rounded-xl border px-3 py-2 text-left transition-colors ${
                                  foundationStyle === style
                                    ? "border-foreground/20 bg-muted text-foreground"
                                    : "border-border/70 bg-background text-muted-foreground hover:bg-muted/70"
                                }`}
                              >
                                <span className="block text-sm font-medium">
                                  {foundationLayerLabels[style]}
                                </span>
                                <span className="mt-1 block text-xs">
                                  Minimized base layer for infra stack context
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-1">
                          <p className="text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase">
                            API provider
                          </p>
                          <div className="grid grid-cols-2 gap-2">
                            {(Object.entries(providers) as Array<
                              [ProviderKey, ProviderDefinition]
                            >).map(([providerKey, providerDefinition]) => (
                              <button
                                key={providerKey}
                                type="button"
                                onClick={() => setProvider(providerKey)}
                                className={`flex items-center justify-between rounded-xl border px-3 py-2 text-left transition-colors ${
                                  provider === providerKey
                                    ? "border-foreground/20 bg-muted text-foreground"
                                    : "border-border/70 bg-background text-muted-foreground hover:bg-muted/70"
                                }`}
                              >
                                <span className="flex items-center gap-2">
                                  <providerDefinition.icon className="size-4 shrink-0" />
                                  <span className="text-sm font-medium">
                                    {providerDefinition.label}
                                  </span>
                                </span>
                                {provider === providerKey ? (
                                  <HugeiconsIcon
                                    icon={Tick02Icon}
                                    strokeWidth={2}
                                    className="size-4 shrink-0"
                                  />
                                ) : null}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-1">
                          <p className="text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase">
                            Model
                          </p>
                          <div className="space-y-2">
                            {activeProvider.models.map((modelOption) => {
                              const isSelected =
                                activeProviderState.model === modelOption.value;

                              return (
                                <button
                                  key={modelOption.value}
                                  type="button"
                                  onClick={() =>
                                    updateProviderModel(modelOption.value)
                                  }
                                  className={`flex w-full items-start justify-between rounded-xl border px-3 py-2.5 text-left transition-colors ${
                                    isSelected
                                      ? "border-foreground/20 bg-muted"
                                      : "border-border/70 bg-background hover:bg-muted/60"
                                  }`}
                                >
                                  <span className="min-w-0">
                                    <span className="block text-sm font-medium text-foreground">
                                      {modelOption.title}
                                    </span>
                                    <span className="block text-xs text-muted-foreground">
                                      {modelOption.description}
                                    </span>
                                  </span>
                                  {isSelected ? (
                                    <HugeiconsIcon
                                      icon={Tick02Icon}
                                      strokeWidth={2}
                                      className="mt-0.5 size-4 shrink-0"
                                    />
                                  ) : null}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <div className="space-y-1">
                          <p className="text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase">
                            Tools
                          </p>
                          <div className="space-y-2">
                            {activeProvider.tools.map((tool) => {
                              const isSelected =
                                activeProviderState.tools.includes(tool.id);

                              return (
                                <button
                                  key={tool.id}
                                  type="button"
                                  onClick={() => toggleProviderTool(tool.id)}
                                  aria-pressed={isSelected}
                                  className={`flex w-full items-start justify-between rounded-xl border px-3 py-2.5 text-left transition-colors ${
                                    isSelected
                                      ? "border-foreground/20 bg-muted"
                                      : "border-border/70 bg-background hover:bg-muted/60"
                                  }`}
                                >
                                  <span className="min-w-0">
                                    <span className="block text-sm font-medium text-foreground">
                                      {tool.label}
                                    </span>
                                    <span className="block text-xs text-muted-foreground">
                                      {tool.description}
                                    </span>
                                  </span>
                                  <span
                                    className={`mt-0.5 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                                      isSelected
                                        ? "bg-foreground text-background"
                                        : "bg-muted text-muted-foreground"
                                    }`}
                                  >
                                    {isSelected ? "On" : "Off"}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <div className="rounded-xl border border-border/70 bg-muted/40 px-3 py-2.5 text-xs text-muted-foreground">
                          <span className="font-medium text-foreground">
                            {activeProvider.label}
                          </span>{" "}
                          powers the chat, while{" "}
                          <span className="font-medium text-foreground">
                            {activeFoundationStack.label}
                          </span>{" "}
                          defines the active infra stack layer. Model, tool, and
                          stack details stay inside this popover so the composer
                          itself remains universal.
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                </PromptInputAction>
              </PromptInputActionGroup>
              <PromptInputActionGroup>
                <PromptInputAction asChild>
                  <Button
                    type="button"
                    size="icon-sm"
                    className="cursor-pointer rounded-full active:scale-97 disabled:opacity-70"
                    disabled={(!busy && !input.trim()) || hasInvalidContext}
                    onClick={() => {
                      if (busy) {
                        void stop();
                        return;
                      }
                      void handleSubmit(input);
                    }}
                    aria-label={
                      busy ? "Stop generation" : "Send message"
                    }
                  >
                    {busy ? (
                      <HugeiconsIcon
                        icon={SquareIcon}
                        strokeWidth={2.0}
                        className="size-3.5 fill-current"
                      />
                    ) : (
                      <HugeiconsIcon
                        icon={ArrowUp02Icon}
                        strokeWidth={2.0}
                        className="size-4"
                      />
                    )}
                  </Button>
                </PromptInputAction>
              </PromptInputActionGroup>
            </PromptInputActions>
          </PromptInput>
        </div>
      </div>
    </div>
  );
}
