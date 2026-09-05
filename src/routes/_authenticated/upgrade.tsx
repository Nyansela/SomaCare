import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { Crown, Check, Sparkles, Users, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useSubscription, type SubscriptionTier } from "@/lib/subscription";

export const Route = createFileRoute("/_authenticated/upgrade")({
  validateSearch: (search: Record<string, unknown>) => {
    const result: { welcome?: boolean } = {};
    if (search.welcome === true) result.welcome = true;
    return result;
  },
  head: () => ({
    meta: [{ title: "Upgrade — SomaCare" }, { name: "robots", content: "noindex" }],
  }),
  component: UpgradePage,
});

type TierPlan = {
  id: SubscriptionTier;
  name: string;
  price: string;
  tagline: string;
  features: string[];
  highlight?: boolean;
};

const PLANS: TierPlan[] = [
  {
    id: "free",
    name: "Free",
    price: "GH₵ 0",
    tagline: "Everyday health tracking",
    features: [
      "Conversational health assistant",
      "Vitals, medication & symptom tracking",
      "Sleep & meal logging",
      "Twi, Ewe & Ga language support",
      "Emergency & clinic finder",
    ],
  },
  {
    id: "premium",
    name: "Plus",
    price: "Premium",
    tagline: "The full Adwoa experience",
    highlight: true,
    features: [
      "Everything in Free",
      "AI-generated workout plans",
      "AI-generated meal plans",
      "AI sleep recommendations & insights",
      "AI nutrition plans & medication timing",
      "Medication interaction checks",
    ],
  },
  {
    id: "family",
    name: "Family",
    price: "Family",
    tagline: "Plus for the whole household",
    features: ["Everything in Plus", "Manage plans for family members", "Shared health context"],
  },
];

const TIER_LABEL: Record<SubscriptionTier, string> = {
  free: "Free",
  premium: "Plus",
  family: "Family",
};

function UpgradePage() {
  const subscription = useSubscription();
  const currentTier = subscription.data?.tier ?? "free";
  const { welcome } = useSearch({ from: "/_authenticated/upgrade" });
  const navigate = useNavigate();

  const continueFree = () => {
    void navigate({ to: "/app", replace: true });
  };

  const [checkoutTier, setCheckoutTier] = useState<string | null>(null);

  const upgrade = async (plan: TierPlan) => {
    if (plan.id === currentTier) return;

    setCheckoutTier(plan.id);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ tier: plan.id }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || "Failed to start checkout");
      }

      const { url } = await response.json();
      if (!url) throw new Error("No checkout URL returned");

      window.location.href = url;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to start checkout");
      setCheckoutTier(null);
    }
  };

  return (
    <AppShell
      title="Upgrade"
      subtitle="Unlock AI-powered plans and insights with SomaCare Plus"
      action={
        <a href="/assistant">
          <Button size="sm" className="soma-gradient soma-glow border-0 text-white">
            <Sparkles className="mr-1.5 h-4 w-4" /> Ask Adwoa
          </Button>
        </a>
      }
    >
      <div className="space-y-6">
        {/* Welcome banner — shown once to new free users right after signup.
            There is always a way out (Continue with Free), so it never feels
            like a forced paywall. */}
        {welcome && currentTier === "free" && (
          <div className="soma-card relative overflow-hidden p-6">
            <div className="absolute inset-0 -z-10 soma-gradient opacity-95" />
            <div className="relative text-white">
              <h2 className="font-display text-xl font-bold sm:text-2xl">
                Welcome to SomaCare! 🎉
              </h2>
              <p className="mt-1 max-w-xl text-sm text-white/85">
                Your health workspace is ready. The Free plan covers everyday tracking — and when
                you're ready for AI-generated plans, personalized insights and unlimited chats,
                SomaCare Plus is one tap away.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  className="bg-white text-primary hover:bg-white/90"
                  onClick={continueFree}
                >
                  Continue with Free
                </Button>
                <span className="inline-flex items-center rounded-full bg-white/15 px-3 py-1.5 text-xs font-medium text-white">
                  No payment required to start
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Current plan banner */}
        <div className="soma-card flex items-center justify-between gap-3 p-5">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/15">
              <Crown className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Current plan
              </p>
              <p className="font-display text-base font-bold">SomaCare {TIER_LABEL[currentTier]}</p>
            </div>
          </div>
          <div className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            {currentTier === "free"
              ? "Free — upgrade to unlock AI features"
              : "All AI features unlocked"}
          </div>
        </div>

        {/* Tier cards */}
        <div className="grid gap-4 md:grid-cols-3">
          {PLANS.map((plan) => {
            const active = plan.id === currentTier;
            return (
              <div
                key={plan.id}
                className={cn(
                  "soma-card flex flex-col p-5",
                  plan.highlight && "border-primary/40 ring-1 ring-primary/30",
                )}
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className={cn(
                      "grid h-9 w-9 place-items-center rounded-xl",
                      plan.highlight
                        ? "soma-gradient soma-glow text-white"
                        : "bg-muted text-foreground",
                    )}
                  >
                    {plan.id === "family" ? (
                      <Users className="h-4 w-4" />
                    ) : plan.highlight ? (
                      <Crown className="h-4 w-4" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                  </div>
                  <div>
                    <div className="font-display text-base font-bold">{plan.name}</div>
                    <div className="text-xs text-muted-foreground">{plan.price}</div>
                  </div>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{plan.tagline}</p>
                <ul className="mt-4 flex-1 space-y-2">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  onClick={() => upgrade(plan)}
                  disabled={active || checkoutTier !== null}
                  className={cn(
                    "mt-5 w-full",
                    plan.highlight && "soma-gradient soma-glow border-0 text-white",
                  )}
                >
                  {checkoutTier === plan.id ? (
                    <>
                      <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                      Starting checkout…
                    </>
                  ) : active ? (
                    "Current plan"
                  ) : (
                    `Upgrade to ${plan.name}`
                  )}
                </Button>
              </div>
            );
          })}
        </div>

        {welcome && currentTier === "free" && (
          <div className="flex justify-center">
            <Button variant="outline" onClick={continueFree}>
              Not now — continue with Free
            </Button>
          </div>
        )}

        <p className="text-center text-xs text-muted-foreground">
          Adwoa AI provides general guidance for informational purposes, not formal diagnosis.
        </p>
      </div>
    </AppShell>
  );
}
