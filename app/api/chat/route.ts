import { streamText, UIMessage, convertToModelMessages } from "ai";
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
  }: { messages: UIMessage[]; model?: string } = await req.json();

  const usePerplexity = isPerplexityModelId(model);
  const languageModel = usePerplexity
    ? perplexityModel(model)
    : (model ?? DEFAULT_GATEWAY_MODEL);

  const result = streamText({
    model: languageModel,
    messages: await convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse({
    sendSources: usePerplexity,
  });
}
