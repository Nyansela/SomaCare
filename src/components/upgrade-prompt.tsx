import { Link } from "@tanstack/react-router";
import { Crown, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Upgrade prompt card shown when a Free-tier user attempts a feature that
 * requires SomaCare Plus (or Family). Links to the existing Upgrade page —
 * it never leaves the user on a dead end.
 */
export function UpgradePrompt({
  featureName,
  description,
  tierLabel = "Plus",
  className,
}: {
  featureName: string;
  description?: string;
  tierLabel?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-primary/20 bg-primary/5 p-6 text-center shadow-sm",
        className,
      )}
    >
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-primary/15">
        <Crown className="h-6 w-6 text-primary" />
      </div>
      <h3 className="mt-3 font-display text-lg font-bold">Unlock {featureName}</h3>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
        {description ??
          `SomaCare ${tierLabel} lets Adwoa build you a personalized ${featureName.toLowerCase()}.`}
      </p>
      <Link to="/upgrade" className="mt-4 inline-block">
        <Button className="soma-gradient soma-glow border-0 text-white">
          <Sparkles className="mr-1.5 h-4 w-4" /> Upgrade to {tierLabel}
        </Button>
      </Link>
    </div>
  );
}