import { createFileRoute } from "@tanstack/react-router";
import Stripe from "stripe";

/**
 * Stripe webhook endpoint. Verifies the signature with STRIPE_WEBHOOK_SECRET,
 * then on checkout.session.completed upgrades the user's profile tier to the
 * tier purchased (read from session metadata — set by /api/create-checkout-session).
 *
 * Uses the service-role admin client because the authenticated role no longer
 * has UPDATE on subscription_tier / bypass_paywall (see migration
 * 20260904000001_subscription_columns_rls.sql).
 */
export const Route = createFileRoute("/api/stripe-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const signature = request.headers.get("stripe-signature");
        const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
        const secretKey = process.env.STRIPE_SECRET_KEY;

        if (!signature || !webhookSecret || !secretKey) {
          return new Response("Stripe webhook is not configured", { status: 503 });
        }

        const rawBody = await request.text();
        const stripe = new Stripe(secretKey);

        let event: Stripe.Event;
        try {
          event = await stripe.webhooks.constructEventAsync(rawBody, signature, webhookSecret);
        } catch {
          return new Response("Invalid signature", { status: 400 });
        }

        if (event.type === "checkout.session.completed") {
          const session = event.data.object as Stripe.Checkout.Session;
          const userId = session.metadata?.user_id;
          const tier = session.metadata?.tier;

          if (userId && (tier === "premium" || tier === "family")) {
            const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
            const { error } = await supabaseAdmin
              .from("profiles")
              .update({ subscription_tier: tier })
              .eq("id", userId);
            if (error) {
              console.error("[stripe-webhook] Failed to update tier:", error.message);
              return new Response("Failed to update profile", { status: 500 });
            }
          }
        }

        return Response.json({ received: true });
      },
    },
  },
});
