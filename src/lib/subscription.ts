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
  /** AI assistant messages used in the current 30-day period. */
  aiRequestsUsed: number;
  /** Start of the current 30-day usage period (null until first use). */
  aiRequestsPeriodStart: string | null;
  /** True once the user has seen the welcome/upgrade page (new-user flow). */
  welcomeSeen: boolean;
};

/** Free-tier allowance: AI assistant messages per 30-day period. */
export const FREE_AI_MESSAGE_LIMIT = 20;

export type AiUsage = {
  /** Per-period allowance; null = unlimited (paid or bypass accounts). */
  limit: number | null;
  used: number;
  remaining: number;
  overLimit: boolean;
};

/**
 * Derive the user's AI usage state. Paid tiers and bypass accounts are
 * unlimited (limit null); only the free tier has a finite allowance. Mirrors
 * the server-side consume_ai_usage() logic in the subscription migration.
 */
export function getAiUsage(info: SubscriptionInfo | undefined): AiUsage {
  const used = info?.aiRequestsUsed ?? 0;
  if (info?.bypassPaywall || (info && info.tier !== "free")) {
    return { limit: null, used, remaining: Number.POSITIVE_INFINITY, overLimit: false };
  }
  const limit = FREE_AI_MESSAGE_LIMIT;
  return {
    limit,
    used,
    remaining: Math.max(limit - used, 0),
    overLimit: used >= limit,
  };
}

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
        .select(
          "subscription_tier, bypass_paywall, ai_requests_used, ai_requests_period_start, welcome_seen",
        )
        .maybeSingle();
      if (error) throw error;
      return {
        tier: (data?.subscription_tier as SubscriptionTier) ?? "free",
        bypassPaywall: data?.bypass_paywall ?? false,
        aiRequestsUsed: data?.ai_requests_used ?? 0,
        aiRequestsPeriodStart: data?.ai_requests_period_start ?? null,
        welcomeSeen: data?.welcome_seen ?? true,
      };
    },
    staleTime: 60_000,
  });
}
