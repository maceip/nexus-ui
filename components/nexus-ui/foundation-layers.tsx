"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  CheckIcon,
  ChevronDownIcon,
  CloudCogIcon,
  Layers2Icon,
  ServerCogIcon,
  SparklesIcon,
} from "lucide-react";
import {
  siApple,
  siDigitalocean,
  siEnvoyproxy,
  siGooglecloud,
  siGooglegemini,
  siLinux,
  siLua,
  siMistralai,
  siNginx,
  siNvidia,
  siOllama,
  siRust,
  siVllm,
} from "simple-icons/icons";
import { cn } from "@/lib/utils";

type IconGlyph = {
  path?: string;
  hex?: string;
  monogram?: string;
};

export type FoundationIconToken =
  | "amazon-bedrock"
  | "apple"
  | "aws"
  | "axolotl"
  | "azure"
  | "azure-openai"
  | "deepspeed"
  | "digitalocean"
  | "envoy"
  | "gemini"
  | "google-cloud"
  | "linux"
  | "lua"
  | "mistral"
  | "nginx"
  | "nvidia"
  | "ollama"
  | "openai"
  | "qwen"
  | "rust"
  | "unsloth"
  | "vertex-ai"
  | "vllm";

export type FoundationStackId = "aws-arbitrage" | "gcp-tpu" | "azure-h100" | "self-hosted";
export type FoundationLayerVariant = "dock" | "rail" | "constellation" | "blueprint";
export type FoundationLayerStyle = FoundationLayerVariant;

type FoundationStage = {
  id: string;
  title: string;
  caption: string;
  icons: FoundationIconToken[];
};

type FoundationStack = {
  id: FoundationStackId;
  label: string;
  shortLabel: string;
  bestFor: string;
  rationale: string;
  accent: string;
  stages: FoundationStage[];
};

type FoundationLayerProps = {
  stackId: FoundationStackId;
  onStackChange: (stackId: FoundationStackId) => void;
  activeIcon?: FoundationIconToken | null;
  onActiveIconChange: (icon: FoundationIconToken) => void;
  defaultCollapsed?: boolean;
  className?: string;
};

const FOUNDATION_STACKS: FoundationStack[] = [
  {
    id: "aws-arbitrage",
    label: "AWS Architecture",
    shortLabel: "AWS",
    bestFor: "Arbitrage play with Bedrock and custom silicon.",
    rationale:
      "DigitalOcean ingress plus Bedrock supervision, Inferentia worker pools, and Trainium fine-tuning tuned for Qwen-class MoE throughput.",
    accent: "from-amber-500/20 via-orange-500/10 to-transparent",
    stages: [
      {
        id: "edge",
        title: "Edge gateway",
        caption: "Bifrost Proxy on DigitalOcean ingress, with Rust-first control logic.",
        icons: ["digitalocean", "rust"],
      },
      {
        id: "supervisor",
        title: "Supervisor",
        caption: "Mistral Small 4 on Amazon Bedrock for the managed control plane.",
        icons: ["amazon-bedrock", "mistral"],
      },
      {
        id: "worker",
        title: "Worker pool",
        caption: "vLLM on Inferentia for Qwen-style sparse expert inference.",
        icons: ["aws", "qwen", "vllm"],
      },
      {
        id: "tuning",
        title: "Tuning loop",
        caption: "Axolotl on Trainium to keep the stack inside AWS economics.",
        icons: ["aws", "axolotl"],
      },
    ],
  },
  {
    id: "gcp-tpu",
    label: "Google Cloud Platform",
    shortLabel: "GCP",
    bestFor: "TPU-native long-context scanning and managed Gemini supervision.",
    rationale:
      "Envoy on Cloud Run and Cloud Armor at the edge, Gemini on Vertex AI for supervision, and TPU-native worker/training paths for sustained context windows.",
    accent: "from-emerald-500/20 via-sky-500/10 to-transparent",
    stages: [
      {
        id: "edge",
        title: "Edge gateway",
        caption: "Cloud Run with Envoy at the boundary and Cloud Armor in front.",
        icons: ["google-cloud", "envoy"],
      },
      {
        id: "supervisor",
        title: "Supervisor",
        caption: "Gemini 1.5 Flash over Vertex AI for managed million-token control.",
        icons: ["gemini", "vertex-ai"],
      },
      {
        id: "worker",
        title: "Worker pool",
        caption: "Google-native TPU inference and container orchestration.",
        icons: ["google-cloud", "vllm"],
      },
      {
        id: "tuning",
        title: "Tuning loop",
        caption: "TPU pods and JAX-centric optimization on Google Cloud.",
        icons: ["google-cloud", "qwen"],
      },
    ],
  },
  {
    id: "azure-h100",
    label: "Microsoft Azure",
    shortLabel: "Azure",
    bestFor: "Infinite-H100 style raw throughput with fused inference kernels.",
    rationale:
      "Azure Front Door and Container Apps up front, Azure OpenAI for supervision, TensorRT-style NVIDIA execution, and DeepSpeed-MoE across the fine-tune path.",
    accent: "from-sky-500/20 via-cyan-500/10 to-transparent",
    stages: [
      {
        id: "edge",
        title: "Edge gateway",
        caption: "Azure Front Door with WAF, cache, and containerized entry control.",
        icons: ["azure"],
      },
      {
        id: "supervisor",
        title: "Supervisor",
        caption: "GPT-4o-mini through Azure OpenAI as the managed top layer.",
        icons: ["azure-openai", "openai"],
      },
      {
        id: "worker",
        title: "Worker pool",
        caption: "NVIDIA-backed H100 inference with fused-kernel acceleration.",
        icons: ["nvidia", "vllm"],
      },
      {
        id: "tuning",
        title: "Tuning loop",
        caption: "DeepSpeed-MoE on Azure ML for large-expert sharding.",
        icons: ["azure", "deepspeed"],
      },
    ],
  },
  {
    id: "self-hosted",
    label: "Self-Hosted",
    shortLabel: "Self",
    bestFor: "Sovereign local inference with long-context memory control.",
    rationale:
      "Linux ingress with OpenResty semantics, Ollama and Mistral for supervision, Apple unified memory for worker acceleration, and Unsloth/NVIDIA for tuning.",
    accent: "from-fuchsia-500/20 via-violet-500/10 to-transparent",
    stages: [
      {
        id: "edge",
        title: "Edge gateway",
        caption: "OpenResty style edge control on local Linux, powered by Nginx and Lua.",
        icons: ["linux", "nginx", "lua"],
      },
      {
        id: "supervisor",
        title: "Supervisor",
        caption: "Ollama-hosted Mistral supervision on the local control plane.",
        icons: ["ollama", "mistral"],
      },
      {
        id: "worker",
        title: "Worker pool",
        caption: "Apple unified memory or local accelerator hardware for private inference.",
        icons: ["apple", "nvidia"],
      },
      {
        id: "tuning",
        title: "Tuning loop",
        caption: "Unsloth Dynamic with local GPU-backed adaptation.",
        icons: ["unsloth", "nvidia"],
      },
    ],
  },
];

const FOUNDATION_ICON_GLYPHS: Record<FoundationIconToken, IconGlyph> = {
  "amazon-bedrock": { monogram: "BD", hex: "FF9900" },
  apple: { path: siApple.path, hex: siApple.hex },
  aws: { monogram: "AWS", hex: "FF9900" },
  axolotl: { monogram: "AX", hex: "8B5CF6" },
  azure: { monogram: "AZ", hex: "0078D4" },
  "azure-openai": { monogram: "AO", hex: "00A4EF" },
  deepspeed: { monogram: "DS", hex: "2563EB" },
  digitalocean: { path: siDigitalocean.path, hex: siDigitalocean.hex },
  envoy: { path: siEnvoyproxy.path, hex: siEnvoyproxy.hex },
  gemini: { path: siGooglegemini.path, hex: siGooglegemini.hex },
  "google-cloud": { path: siGooglecloud.path, hex: siGooglecloud.hex },
  linux: { path: siLinux.path, hex: siLinux.hex },
  lua: { path: siLua.path, hex: siLua.hex },
  mistral: { path: siMistralai.path, hex: siMistralai.hex },
  nginx: { path: siNginx.path, hex: siNginx.hex },
  nvidia: { path: siNvidia.path, hex: siNvidia.hex },
  ollama: { path: siOllama.path, hex: siOllama.hex },
  openai: { monogram: "OA", hex: "10A37F" },
  qwen: { monogram: "QW", hex: "6D28D9" },
  rust: { path: siRust.path, hex: siRust.hex },
  unsloth: { monogram: "UN", hex: "F43F5E" },
  "vertex-ai": { monogram: "VA", hex: "34A853" },
  vllm: { path: siVllm.path, hex: siVllm.hex },
};

const FOUNDATION_ICON_LABELS: Record<FoundationIconToken, string> = {
  "amazon-bedrock": "Amazon Bedrock",
  apple: "Apple",
  aws: "AWS",
  axolotl: "Axolotl",
  azure: "Azure",
  "azure-openai": "Azure OpenAI",
  deepspeed: "DeepSpeed",
  digitalocean: "DigitalOcean",
  envoy: "Envoy",
  gemini: "Gemini",
  "google-cloud": "Google Cloud",
  linux: "Linux",
  lua: "Lua",
  mistral: "Mistral",
  nginx: "Nginx",
  nvidia: "NVIDIA",
  ollama: "Ollama",
  openai: "OpenAI",
  qwen: "Qwen",
  rust: "Rust",
  unsloth: "Unsloth",
  "vertex-ai": "Vertex AI",
  vllm: "vLLM",
};

const FOUNDATION_VARIANT_OPTIONS: Array<{
  id: FoundationLayerVariant;
  label: string;
}> = [
  { id: "dock", label: "Dock" },
  { id: "rail", label: "Rail" },
  { id: "constellation", label: "Constellation" },
  { id: "blueprint", label: "Blueprint" },
];

function findStack(stackId: FoundationStackId) {
  return FOUNDATION_STACKS.find((stack) => stack.id === stackId) ?? FOUNDATION_STACKS[0];
}

function firstStackIcon(stack: FoundationStack) {
  return stack.stages.flatMap((stage) => stage.icons)[0];
}

function flattenStackIcons(stack: FoundationStack) {
  return [...new Set(stack.stages.flatMap((stage) => stage.icons))];
}

function iconBelongsToStack(stack: FoundationStack, icon: FoundationIconToken) {
  return stack.stages.some((stage) => stage.icons.includes(icon));
}

function StageIconButton({
  icon,
  active,
  linked,
  variant,
  onClick,
}: {
  icon: FoundationIconToken;
  active: boolean;
  linked: boolean;
  variant: FoundationLayerVariant;
  onClick: (icon: FoundationIconToken) => void;
}) {
  const glyph = FOUNDATION_ICON_GLYPHS[icon];
  const baseTone =
    variant === "blueprint"
      ? "border-white/10 bg-white/5 text-white"
      : "border-border bg-background text-foreground";
  const linkedTone =
    variant === "blueprint"
      ? "border-sky-400/30 bg-sky-400/10 text-sky-100"
      : "border-primary/20 bg-primary/8 text-foreground";
  const activeTone =
    variant === "blueprint"
      ? "border-sky-300/60 bg-sky-400/15 text-white shadow-[0_0_0_1px_rgba(125,211,252,0.2),0_0_28px_rgba(56,189,248,0.18)]"
      : "border-primary/40 bg-primary/12 text-foreground shadow-[0_0_0_1px_rgba(99,102,241,0.08),0_12px_32px_-20px_rgba(59,130,246,0.45)]";

  return (
    <button
      type="button"
      onClick={() => onClick(icon)}
      className={cn(
        "inline-flex size-9 items-center justify-center rounded-xl border transition-all duration-250",
        active ? activeTone : linked ? linkedTone : baseTone,
      )}
      title={FOUNDATION_ICON_LABELS[icon]}
      aria-label={FOUNDATION_ICON_LABELS[icon]}
    >
      {glyph.path ? (
        <svg
          viewBox="0 0 24 24"
          className="size-4.5"
          aria-hidden="true"
          fill={`#${glyph.hex ?? "currentColor"}`}
        >
          <path d={glyph.path} />
        </svg>
      ) : (
        <span
          className="text-[10px] font-semibold tracking-[0.16em] uppercase"
          style={{ color: `#${glyph.hex ?? "FFFFFF"}` }}
        >
          {glyph.monogram}
        </span>
      )}
    </button>
  );
}

function StageCard({
  stage,
  variant,
  activeIcon,
  stack,
  onIconClick,
}: {
  stage: FoundationStage;
  variant: FoundationLayerVariant;
  activeIcon: FoundationIconToken;
  stack: FoundationStack;
  onIconClick: (icon: FoundationIconToken) => void;
}) {
  const cardClassName = {
    dock: "rounded-2xl border border-border bg-background/80 p-4 shadow-sm",
    rail: "rounded-2xl border border-border bg-muted/30 p-4",
    constellation:
      "rounded-[22px] border border-primary/15 bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.14),transparent_60%),rgba(255,255,255,0.78)] p-4 shadow-[0_18px_44px_-30px_rgba(79,70,229,0.35)] dark:bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.18),transparent_55%),rgba(9,9,11,0.72)]",
    blueprint:
      "rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.94),rgba(2,6,23,0.96))] p-4 text-white shadow-[0_20px_50px_-34px_rgba(14,165,233,0.45)]",
  }[variant];

  const captionClassName =
    variant === "blueprint" ? "text-white/65" : "text-muted-foreground";

  return (
    <div className={cardClassName}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div
            className={cn(
              "text-xs font-semibold tracking-[0.16em] uppercase",
              variant === "blueprint" ? "text-sky-200/70" : "text-muted-foreground",
            )}
          >
            {stage.title}
          </div>
          <div
            className={cn(
              "mt-1 text-sm font-medium",
              variant === "blueprint" ? "text-white" : "text-foreground",
            )}
          >
            {stage.caption}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {stage.icons.map((icon) => (
            <StageIconButton
              key={`${stage.id}-${icon}`}
              icon={icon}
              variant={variant}
              active={activeIcon === icon}
              linked={iconBelongsToStack(stack, icon)}
              onClick={onIconClick}
            />
          ))}
        </div>
      </div>
      <div className={cn("mt-3 text-xs leading-5", captionClassName)}>
        {FOUNDATION_ICON_LABELS[stage.icons[0]]} anchors this layer inside the{" "}
        {stack.shortLabel} stack.
      </div>
    </div>
  );
}

function FoundationLayerBase({
  stackId,
  onStackChange,
  activeIcon,
  onActiveIconChange,
  defaultCollapsed = true,
  variant,
  className,
}: FoundationLayerProps & { variant: FoundationLayerVariant }) {
  const [collapsed, setCollapsed] = React.useState(defaultCollapsed);
  const stack = findStack(stackId);
  const stackIcons = flattenStackIcons(stack);
  const resolvedActiveIcon =
    activeIcon && iconBelongsToStack(stack, activeIcon)
      ? activeIcon
      : firstStackIcon(stack);

  const shellClassName = {
    dock: "rounded-2xl border border-border/80 bg-card/90 shadow-sm",
    rail: "rounded-[24px] border border-border bg-muted/20 shadow-sm",
    constellation:
      "rounded-[26px] border border-primary/15 bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.18),transparent_62%),rgba(255,255,255,0.88)] shadow-[0_24px_60px_-36px_rgba(99,102,241,0.35)] dark:bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.22),transparent_55%),rgba(9,9,11,0.76)]",
    blueprint:
      "rounded-[26px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.97),rgba(2,6,23,0.98))] text-white shadow-[0_24px_70px_-42px_rgba(14,165,233,0.48)]",
  }[variant];

  const stageLayoutClassName = {
    dock: "mt-4 grid gap-3 xl:grid-cols-4",
    rail: "mt-4 space-y-3",
    constellation: "mt-4 grid gap-3 lg:grid-cols-2",
    blueprint: "mt-4 grid gap-3 lg:grid-cols-2",
  }[variant];

  const bodyInsetClassName = variant === "blueprint" ? "p-4" : "p-3";

  return (
    <motion.div layout className={cn(shellClassName, className)}>
      <button
        type="button"
        className={cn(
          "flex w-full items-center justify-between gap-4 text-left",
          bodyInsetClassName,
        )}
        onClick={() => setCollapsed((value) => !value)}
      >
        <div className="min-w-0">
          <div
            className={cn(
              "flex items-center gap-2 text-sm font-medium",
              variant === "blueprint" ? "text-white" : "text-foreground",
            )}
          >
            <Layers2Icon className="size-4" />
            Foundation layer
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[11px] font-semibold tracking-[0.16em] uppercase",
                variant === "blueprint"
                  ? "bg-white/10 text-sky-100"
                  : "bg-primary/8 text-primary",
              )}
            >
              {stack.shortLabel}
            </span>
          </div>
          <div
            className={cn(
              "mt-1 text-xs leading-5",
              variant === "blueprint" ? "text-white/65" : "text-muted-foreground",
            )}
          >
            {stack.bestFor}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <div className="hidden items-center gap-1.5 sm:flex">
            {stackIcons.slice(0, 5).map((icon) => (
              <StageIconButton
                key={`preview-${variant}-${icon}`}
                icon={icon}
                variant={variant}
                active={resolvedActiveIcon === icon}
                linked
                onClick={onActiveIconChange}
              />
            ))}
          </div>
          <motion.div animate={{ rotate: collapsed ? 0 : 180 }} transition={{ duration: 0.22 }}>
            <ChevronDownIcon className="size-4" />
          </motion.div>
        </div>
      </button>

      <AnimatePresence initial={false}>
        {!collapsed ? (
          <motion.div
            key={`${variant}-expanded`}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className={cn("border-t", variant === "blueprint" ? "border-white/10" : "border-border", bodyInsetClassName)}>
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                {FOUNDATION_STACKS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      onStackChange(item.id);
                      onActiveIconChange(firstStackIcon(item));
                    }}
                    className={cn(
                      "rounded-2xl border px-3 py-3 text-left transition-all",
                      item.id === stack.id
                        ? variant === "blueprint"
                          ? "border-sky-300/40 bg-white/10 text-white"
                          : "border-primary/20 bg-primary/8 text-foreground"
                        : variant === "blueprint"
                          ? "border-white/10 bg-white/[0.03] text-white/70 hover:bg-white/[0.06]"
                          : "border-border bg-background/70 text-muted-foreground hover:bg-muted/40",
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-medium">{item.label}</div>
                      {item.id === stack.id ? <CheckIcon className="size-4" /> : null}
                    </div>
                    <div className="mt-2 text-xs leading-5 opacity-80">{item.bestFor}</div>
                  </button>
                ))}
              </div>

              <div className={stageLayoutClassName}>
                {stack.stages.map((stage) => (
                  <StageCard
                    key={`${variant}-${stack.id}-${stage.id}`}
                    stage={stage}
                    variant={variant}
                    activeIcon={resolvedActiveIcon}
                    stack={stack}
                    onIconClick={onActiveIconChange}
                  />
                ))}
              </div>

              <motion.div
                layout
                className={cn(
                  "mt-4 rounded-2xl border px-4 py-3",
                  variant === "blueprint"
                    ? "border-white/10 bg-white/[0.04] text-white"
                    : "border-border bg-background/75 text-foreground",
                )}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <SparklesIcon
                    className={cn(
                      "size-4",
                      variant === "blueprint" ? "text-sky-200" : "text-primary",
                    )}
                  />
                  <span className="text-sm font-medium">
                    {FOUNDATION_ICON_LABELS[resolvedActiveIcon]}
                  </span>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[11px] font-semibold tracking-[0.16em] uppercase",
                      variant === "blueprint"
                        ? "bg-white/10 text-sky-100"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {stack.label}
                  </span>
                </div>
                <div
                  className={cn(
                    "mt-2 text-xs leading-5",
                    variant === "blueprint" ? "text-white/65" : "text-muted-foreground",
                  )}
                >
                  {stack.rationale}
                </div>
              </motion.div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.div>
  );
}

export function FoundationDock(props: FoundationLayerProps) {
  return <FoundationLayerBase {...props} variant="dock" />;
}

export function FoundationRail(props: FoundationLayerProps) {
  return <FoundationLayerBase {...props} variant="rail" />;
}

export function FoundationConstellation(props: FoundationLayerProps) {
  return <FoundationLayerBase {...props} variant="constellation" />;
}

export function FoundationBlueprint(props: FoundationLayerProps) {
  return <FoundationLayerBase {...props} variant="blueprint" />;
}

export function FoundationLayerStylePicker({
  value,
  onValueChange,
  className,
}: {
  value: FoundationLayerVariant;
  onValueChange: (value: FoundationLayerVariant) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {FOUNDATION_VARIANT_OPTIONS.map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() => onValueChange(option.id)}
          className={cn(
            "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
            value === option.id
              ? "border-primary/20 bg-primary/8 text-foreground"
              : "border-border bg-background text-muted-foreground hover:bg-muted/60",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export { FOUNDATION_STACKS };
