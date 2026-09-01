/**
 * Stub replacement for `@ai-sdk/gateway`.
 *
 * The real `@ai-sdk/gateway` imports `@vercel/oidc` which eagerly requires
 * `node:fs` — crashing on Cloudflare Workers. This app never uses the AI
 * Gateway (Gemini is accessed via `@ai-sdk/openai-compatible`), so we safely
 * stub out every export that the `ai` package re-exports from it.
 */

class GatewayError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "GatewayError";
  }
}

class GatewayAuthenticationError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "GatewayAuthenticationError";
  }
}

/** No-op gateway provider — calling it will throw if actually invoked. */
export function gateway(..._args: unknown[]) {
  throw new Error(
    "AI Gateway is not available on this deployment. Use @ai-sdk/openai-compatible directly.",
  );
}

/** No-op createGateway. */
export function createGateway(..._args: unknown[]) {
  throw new Error(
    "AI Gateway is not available on this deployment. Use @ai-sdk/openai-compatible directly.",
  );
}

export { GatewayError, GatewayAuthenticationError };

// GatewayModelId is a string union type used only at the type level —
// erased at compile time, so we export a placeholder.
export type GatewayModelId = string;
