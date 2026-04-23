import { streamText, type UIMessage, convertToModelMessages } from "ai";
import { perplexity as perplexityModel } from "@ai-sdk/perplexity";

const PERPLEXITY_MODEL_IDS = [
  "sonar",
  "sonar-pro",
  "sonar-reasoning",
  "sonar-reasoning-pro",
  "sonar-deep-research",
] as const;

type PerplexityModelId = (typeof PERPLEXITY_MODEL_IDS)[number];

const DEFAULT_GATEWAY_MODEL = "anthropic/claude-sonnet-4.5";

type ChatRequestBody = {
  messages: UIMessage[];
  model?: string;
  provider?: "claude" | "v0" | "gemini" | "chatgpt";
  tools?: string[];
  contexts?: {
    github?: string;
    huggingface?: string;
  };
};

function isPerplexityModelId(
  model: string | undefined,
): model is PerplexityModelId {
  return (
    model != null &&
    (PERPLEXITY_MODEL_IDS as readonly string[]).includes(model)
  );
}

export async function POST(req: Request) {
  const {
    messages,
    model,
    provider,
    tools,
    contexts,
  }: ChatRequestBody = await req.json();

  const usePerplexity = isPerplexityModelId(model);
  const languageModel = usePerplexity
    ? perplexityModel(model)
    : (model ?? DEFAULT_GATEWAY_MODEL);

  const system = buildSystemPrompt({
    provider,
    tools,
    contexts,
  });

  const result = streamText({
    model: languageModel,
    system,
    messages: await convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse({
    sendSources: usePerplexity,
  });
}

function buildSystemPrompt({
  provider,
  tools,
  contexts,
}: Pick<ChatRequestBody, "provider" | "tools" | "contexts">) {
  const lines = [
    "You are helping with a UI implementation and app-building workflow.",
  ];

  if (provider) {
    lines.push(`Active provider: ${provider}.`);
  }

  if (tools != null && tools.length > 0) {
    lines.push(`Enabled tools/preferences: ${tools.join(", ")}.`);
  }

  if (contexts?.github) {
    lines.push(`Primary GitHub repository context: ${contexts.github}.`);
  }

  if (contexts?.huggingface) {
    lines.push(`Primary Hugging Face repository context: ${contexts.huggingface}.`);
  }

  lines.push(
    "Use any provided repository context when it is relevant, but do not fabricate missing details.",
  );

  return lines.join("\n");
}
