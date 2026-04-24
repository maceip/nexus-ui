import { z } from "zod";

const MAX_TEXT_LENGTH = 32_000;
const MAX_CONTEXT_LENGTH = 512;

const optionalContextString = z
  .string()
  .trim()
  .min(1)
  .max(MAX_CONTEXT_LENGTH)
  .optional();

export const agentSpecInputSchema = z.object({
  userRequest: z.string().min(1).max(MAX_TEXT_LENGTH),
  llmResponse: z.string().min(1).max(MAX_TEXT_LENGTH),
  contexts: z
    .object({
      github: optionalContextString,
      huggingface: optionalContextString,
    })
    .optional(),
});

export type AgentSpecInput = z.infer<typeof agentSpecInputSchema>;
