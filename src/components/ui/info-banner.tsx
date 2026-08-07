/**
 * InfoBanner — standard alert/disclaimer/warning surface for the app.
 * Tones mirror the StatusBadge palette (token-based, dark-mode safe).
 * Use this instead of hand-rolled `bg-amber-50 border-amber-200 …` divs.
 */
import { AlertTriangle, Info, CheckCircle2, OctagonAlert, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StatusTone } from "@/components/ui/status-badge";

const TONE_STYLES: Record<StatusTone, string> = {
  success:
    "bg-[var(--success-soft)] text-[var(--success-soft-foreground)] border-[color-mix(in_oklab,var(--success-soft-foreground)_25%,transparent)]",
  warning:
    "bg-[var(--warning-soft)] text-[var(--warning-soft-foreground)] border-[color-mix(in_oklab,var(--warning-soft-foreground)_25%,transparent)]",
  danger:
    "bg-[var(--danger-soft)] text-[var(--danger-soft-foreground)] border-[color-mix(in_oklab,var(--danger-soft-foreground)_25%,transparent)]",
  accent:
    "bg-[var(--accent-soft)] text-[var(--accent-soft-foreground)] border-[color-mix(in_oklab,var(--accent-soft-foreground)_25%,transparent)]",
  default: "bg-muted text-muted-foreground border-border",
};

const TONE_ICONS: Record<StatusTone, LucideIcon> = {
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: OctagonAlert,
  accent: Info,
  default: Info,
};

interface InfoBannerProps {
  tone?: StatusTone;
  title?: React.ReactNode;
  icon?: LucideIcon;
  className?: string;
  children: React.ReactNode;
}

export function InfoBanner({ tone = "accent", title, icon, className, children }: InfoBannerProps) {
  const Icon = icon ?? TONE_ICONS[tone];
  return (
    <div className={cn("flex items-start gap-2.5 rounded-xl border p-3 text-sm", TONE_STYLES[tone], className)}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0">
        {title && <div className="font-semibold">{title}</div>}
        <div className={cn(title && "mt-0.5")}>{children}</div>
      </div>
    </div>
  );
}
