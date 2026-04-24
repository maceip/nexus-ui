import { z } from "zod";

import { bundleTierSchema } from "@/lib/server/bundle-spec/schema";

const MAX_TEXT_LENGTH = 64_000;
const MAX_CONTEXT_LENGTH = 512;

const optionalContextString = z
  .string()
  .trim()
  .min(1)
  .max(MAX_CONTEXT_LENGTH)
  .optional();

export const bundleSpecInputSchema = z.object({
  userRequest: z.string().min(1).max(MAX_TEXT_LENGTH),
  llmResponse: z.string().min(1).max(MAX_TEXT_LENGTH),
  bundleTier: bundleTierSchema.default("M"),
  contexts: z
    .object({
      github: optionalContextString,
      huggingface: optionalContextString,
    })
    .optional(),
});

export type BundleSpecInput = z.infer<typeof bundleSpecInputSchema>;
