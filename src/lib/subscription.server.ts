// Server-only subscription tier helpers. Import this module from server
// routes (dynamically, like other .server modules) — never from client code.
//
// Tier naming: the user-facing name "Plus" maps to the database value
// 'premium'; "Family" maps to 'family'. See the subscription migration.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type SubscriptionTier = "free" | "premium" | "family";

/** User-facing "Plus" → database value 'premium'. */
export const TIER_PLUS: SubscriptionTier = "premium";
/** User-facing "Family" → database value 'family'. */
export const TIER_FAMILY: SubscriptionTier = "family";

const TIER_RANK: Record<SubscriptionTier, number> = {
  free: 0,
  premium: 1,
  family: 2,
};

/**
 * True when the user's account satisfies `requiredTier`.
 *
 * `bypass_paywall` is checked FIRST and overrides the tier entirely, so
 * accounts with bypass_paywall=true always pass regardless of their
 * subscription_tier value.
 *
 * This is the ONLY function that should be used to check tier access —
 * do not write ad-hoc tier checks elsewhere.
 */
export async function hasAccess(userId: string, requiredTier: SubscriptionTier): Promise<boolean> {
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("subscription_tier, bypass_paywall")
    .eq("id", userId)
    .maybeSingle();

  if (!profile) return false;

  if (profile.bypass_paywall) return true;

  const tier = (profile.subscription_tier as SubscriptionTier) || "free";
  return TIER_RANK[tier] >= TIER_RANK[requiredTier];
}
