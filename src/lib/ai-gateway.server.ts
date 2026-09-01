import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { loadDevVars } from "./env-loader.server";

loadDevVars();

const GEMINI_MODEL_ID = "gemini-3.5-flash-lite";

export class AiProviderNotConfiguredError extends Error {}

export const AI_NOT_CONFIGURED_MESSAGE =
  "AI provider not configured. Set GEMINI_API_KEY.";

/** Names of the providers currently configured (for diagnostics/logging). */
export function getConfiguredProviderNames(): string[] {
  const key = process.env.GEMINI_API_KEY;
  return key ? ["gemini"] : [];
}

/**
 * Returns the Gemini 3.5 Flash Lite model via @ai-sdk/openai-compatible
 * (Google's OpenAI-compatible endpoint). This avoids the @ai-sdk/gateway
 * dependency that pulls in node:fs and crashes on Cloudflare Workers.
 */
export function createAiModel() {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    throw new AiProviderNotConfiguredError(AI_NOT_CONFIGURED_MESSAGE);
  }
  const provider = createOpenAICompatible({
    name: "gemini",
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai",
    headers: { Authorization: `Bearer ${geminiKey}` },
  });
  return provider(GEMINI_MODEL_ID);
}
