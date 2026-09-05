import { createFileRoute } from "@tanstack/react-router";
import Stripe from "stripe";

/**
 * Creates a Stripe Checkout Session for the requested tier.
 *
 * Price IDs are read from environment variables — never hardcoded:
 *   premium → STRIPE_PRICE_PLUS
 *   family  → STRIPE_PRICE_FAMILY
 *
 * On success returns { url } (Stripe-hosted checkout). The profile's
 * subscription_tier is only updated by the /api/stripe-webhook handler
 * after payment succeeds — never by this route.
 */
export const Route = createFileRoute("/api/create-checkout-session")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { authenticateRequest } = await import("@/lib/api-auth.server");
        const { TIER_PLUS, TIER_FAMILY } = await import("@/lib/subscription.server");
        const authed = await authenticateRequest(request);
        if (!authed) {
          return new Response("Unauthorized", { status: 401 });
        }
        const { userId } = authed;

        const body = (await request.json().catch(() => ({}))) as {
          tier?: string;
        };
        const tier = body.tier;

        if (tier !== TIER_PLUS && tier !== TIER_FAMILY) {
          return Response.json(
            { error: "invalid_tier", message: "Tier must be 'premium' or 'family'." },
            { status: 400 },
          );
        }

        const priceId =
          tier === TIER_FAMILY ? process.env.STRIPE_PRICE_FAMILY : process.env.STRIPE_PRICE_PLUS;

        if (!priceId) {
          return Response.json(
            {
              error: "checkout_not_configured",
              message:
                "Checkout is not configured yet. Contact support to have this tier enabled on your account.",
            },
            { status: 503 },
          );
        }

        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

        const origin = new URL(request.url).origin;
        const session = await stripe.checkout.sessions.create({
          mode: "subscription",
          line_items: [{ price: priceId, quantity: 1 }],
          client_reference_id: userId,
          metadata: { user_id: userId, tier },
          allow_promotion_codes: true,
          success_url: `${origin}/upgrade?checkout=success`,
          cancel_url: `${origin}/upgrade?checkout=cancelled`,
        });

        return Response.json({ url: session.url });
      },
    },
  },
});
