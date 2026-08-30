import { google } from "@ai-sdk/google";
import { loadDevVars } from "./env-loader.server";

loadDevVars();

export class AiProviderNotConfiguredError extends Error {}

export const AI_NOT_CONFIGURED_MESSAGE =
  "AI provider not configured. Set GEMINI_API_KEY.";

/** Names of the providers currently configured (for diagnostics/logging). */
export function getConfiguredProviderNames(): string[] {
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  return key ? ["gemini"] : [];
}

/**
 * Returns the Gemini 3.5 Flash Lite model via @ai-sdk/google.
 * Throws `AiProviderNotConfiguredError` when GEMINI_API_KEY is not configured.
 */
export function createAiModel() {
  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!geminiKey) {
    throw new AiProviderNotConfiguredError(AI_NOT_CONFIGURED_MESSAGE);
  }
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = geminiKey;
  }
  return google("gemini-3.5-flash-lite", { apiKey: geminiKey });
}
