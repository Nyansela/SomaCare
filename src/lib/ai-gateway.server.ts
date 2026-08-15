import { createOpenAICompatible, type OpenAICompatibleProvider } from "@ai-sdk/openai-compatible";

type ProviderModel = ReturnType<OpenAICompatibleProvider["languageModel"]>;
type CallOptions = Parameters<ProviderModel["doGenerate"]>[0];

/**
 * Shape of the model we hand to `streamText` / `generateText`. It is
 * structurally identical to the AI SDK's `LanguageModelV4` interface.
 */
export type AiModelLike = {
  specificationVersion: "v4";
  provider: string;
  modelId: string;
  supportedUrls: ProviderModel["supportedUrls"];
  doGenerate(options: CallOptions): Promise<Awaited<ReturnType<ProviderModel["doGenerate"]>>>;
  doStream(options: CallOptions): Promise<Awaited<ReturnType<ProviderModel["doStream"]>>>;
};

type ConfiguredModel = { name: string; model: ProviderModel };

const NVIDIA_MODEL_ID = "meta/llama-3.1-70b-instruct";
const GEMINI_MODEL_ID = "gemini-2.5-flash";
const LOVABLE_MODEL_ID = "google/gemini-3-flash-preview";

export class AiProviderNotConfiguredError extends Error {}

export const AI_NOT_CONFIGURED_MESSAGE =
  "AI provider not configured. Set NVIDIA_API_KEY, GEMINI_API_KEY, or LOVABLE_API_KEY.";

/**
 * Builds the ordered list of available providers. Only providers whose env key
 * is present are included, so the app degrades gracefully when keys are
 * missing instead of hard-failing on a single provider.
 */
function buildConfiguredModels(): ConfiguredModel[] {
  const models: ConfiguredModel[] = [];

  const nvidiaKey = process.env.NVIDIA_API_KEY;
  if (nvidiaKey) {
    const provider = createOpenAICompatible({
      name: "nvidia-nim",
      baseURL: "https://integrate.api.nvidia.com/v1",
      headers: { Authorization: `Bearer ${nvidiaKey}` },
    });
    models.push({ name: "nvidia", model: provider(NVIDIA_MODEL_ID) });
  }

  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey) {
    const provider = createOpenAICompatible({
      name: "gemini-fallback",
      baseURL: "https://generativelanguage.googleapis.com/v1beta/openai",
      headers: { Authorization: `Bearer ${geminiKey}` },
    });
    models.push({ name: "gemini", model: provider(GEMINI_MODEL_ID) });
  }

  const lovableKey = process.env.LOVABLE_API_KEY;
  if (lovableKey) {
    const provider = createOpenAICompatible({
      name: "lovable-ai-gateway",
      baseURL: "https://ai.gateway.lovable.dev/v1",
      headers: { "Lovable-API-Key": lovableKey },
    });
    models.push({ name: "lovable", model: provider(LOVABLE_MODEL_ID) });
  }

  return models;
}

/** Names of the providers currently configured (for diagnostics/logging). */
export function getConfiguredProviderNames(): string[] {
  return buildConfiguredModels().map((m) => m.name);
}

/**
 * Returns a model that tries each configured provider in order. If the primary
 * provider fails at request time (invalid key, model unavailable, quota, etc.),
 * the call is retried with the next provider. Throws `AiProviderNotConfiguredError`
 * when no provider is configured.
 */
export function createAiModel(): AiModelLike {
  const models = buildConfiguredModels();
  if (models.length === 0) {
    throw new AiProviderNotConfiguredError(AI_NOT_CONFIGURED_MESSAGE);
  }
  return withFallback(models);
}

function withFallback(models: ConfiguredModel[]): AiModelLike {
  const primary = models[0];
  return {
    specificationVersion: "v4",
    provider: primary.model.provider,
    modelId: primary.model.modelId,
    supportedUrls: primary.model.supportedUrls,
    async doGenerate(options) {
      let lastError: unknown;
      for (const { name, model } of models) {
        try {
          return await model.doGenerate(options);
        } catch (err) {
          lastError = err;
          console.error(`[ai-gateway] provider "${name}" failed (doGenerate), trying next:`, err);
        }
      }
      throw lastError instanceof Error ? lastError : new Error("All AI providers failed.");
    },
    async doStream(options) {
      let lastError: unknown;
      for (const { name, model } of models) {
        try {
          return await model.doStream(options);
        } catch (err) {
          lastError = err;
          console.error(`[ai-gateway] provider "${name}" failed (doStream), trying next:`, err);
        }
      }
      throw lastError instanceof Error ? lastError : new Error("All AI providers failed.");
    },
  };
}
