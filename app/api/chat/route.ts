import { streamText, UIMessage, convertToModelMessages } from "ai";
import { perplexity } from "@ai-sdk/perplexity";

const PERPLEXITY_MODEL_IDS = [
  "sonar",
  "sonar-pro",
  "sonar-reasoning",
  "sonar-reasoning-pro",
  "sonar-deep-research",
] as const;

type PerplexityModelId = (typeof PERPLEXITY_MODEL_IDS)[number];

function resolvePerplexityModel(model: string | undefined): PerplexityModelId {
  if (
    model != null &&
    (PERPLEXITY_MODEL_IDS as readonly string[]).includes(model)
  ) {
    return model as PerplexityModelId;
  }
  return "sonar-pro";
}

export async function POST(req: Request) {
  const {
    messages,
    model,
  }: { messages: UIMessage[]; model?: string } = await req.json();

  const result = streamText({
    model: perplexity(resolvePerplexityModel(model)),
    messages: await convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse({ sendSources: true });
}
