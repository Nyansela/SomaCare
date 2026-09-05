// Client-side subscription helpers. Read-only tier checks for UI gating —
// authoritative server-side checks live in src/lib/subscription.server.ts.
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type SubscriptionTier = "free" | "premium" | "family";

/** User-facing "Plus" → database value 'premium'. */
export const TIER_PLUS = "premium";
/** User-facing "Family" → database value 'family'. */
export const TIER_FAMILY = "family";

const TIER_RANK: Record<SubscriptionTier, number> = {
  free: 0,
  premium: 1,
  family: 2,
};

/**
 * Client-side tier check. `bypassPaywall` is checked first and overrides the
 * tier, mirroring the server-side hasAccess() logic.
 */
export function hasTierAccess(
  tier: SubscriptionTier | null | undefined,
  requiredTier: SubscriptionTier,
  bypassPaywall = false,
): boolean {
  if (bypassPaywall) return true;
  return TIER_RANK[tier ?? "free"] >= TIER_RANK[requiredTier];
}

export type SubscriptionInfo = {
  tier: SubscriptionTier;
  bypassPaywall: boolean;
};

/**
 * The current user's subscription status. RLS limits the profiles read to the
 * signed-in user's own row.
 */
export function useSubscription() {
  return useQuery({
    queryKey: ["subscription"],
    queryFn: async (): Promise<SubscriptionInfo> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("subscription_tier, bypass_paywall")
        .maybeSingle();
      if (error) throw error;
      return {
        tier: (data?.subscription_tier as SubscriptionTier) ?? "free",
        bypassPaywall: data?.bypass_paywall ?? false,
      };
    },
    staleTime: 60_000,
  });
}