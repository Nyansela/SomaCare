import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

export type AiProvider = {
  model: (id: string) => ReturnType<ReturnType<typeof createOpenAICompatible>>;
  source: "lovable" | "gemini";
  /** Resolve a Lovable-style model id (e.g. "google/gemini-3-flash-preview") to what the underlying provider expects. */
  resolveModel: (id: string) => string;
};

/**
 * Returns a working AI provider. Prefers Lovable AI Gateway (LOVABLE_API_KEY),
 * falls back to Google Gemini via its OpenAI-compatible endpoint (GEMINI_API_KEY).
 * Throws only when neither is configured.
 */
export function createLovableAiGatewayProvider(_apiKey?: string): AiProvider {
  const lovableKey = _apiKey ?? process.env.LOVABLE_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;

  if (lovableKey) {
    const p = createOpenAICompatible({
      name: "lovable-ai-gateway",
      baseURL: "https://ai.gateway.lovable.dev/v1",
      headers: { "Lovable-API-Key": lovableKey },
    });
    return { model: (id) => p(id), source: "lovable", resolveModel: (id) => id };
  }

  if (geminiKey) {
    const p = createOpenAICompatible({
      name: "gemini-fallback",
      baseURL: "https://generativelanguage.googleapis.com/v1beta/openai",
      headers: { Authorization: `Bearer ${geminiKey}` },
    });
    return {
      model: (id) => p(mapToGemini(id)),
      source: "gemini",
      resolveModel: mapToGemini,
    };
  }

  throw new Error(
    "AI is not configured. Set LOVABLE_API_KEY (Lovable Cloud auto-provisions this) or GEMINI_API_KEY as a fallback.",
  );
}

/** Map Lovable-gateway model ids to native Gemini ids for the fallback path. */
function mapToGemini(id: string): string {
  // Strip vendor prefix if present.
  const bare = id.includes("/") ? id.split("/").slice(1).join("/") : id;
  // Preview/flash variants → stable public gemini-2.5-flash.
  if (/flash/i.test(bare)) return "gemini-2.5-flash";
  if (/pro/i.test(bare)) return "gemini-2.5-pro";
  return "gemini-2.5-flash";
}
