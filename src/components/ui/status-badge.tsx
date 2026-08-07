/**
 * StatusBadge — thin wrapper around the HeroUI Badge, scoped for status
 * indicators in the app (vitals abnormalities, MedVerify results, schedule
 * item types). Keeps @heroui/react usage contained to this one component.
 */
import { Badge } from "@heroui/react";
import { cn } from "@/lib/utils";

export type StatusTone = "success" | "warning" | "danger" | "accent" | "default";

interface StatusBadgeProps {
  tone?: StatusTone;
  size?: "sm" | "md" | "lg";
  className?: string;
  children: React.ReactNode;
}

export function StatusBadge({ tone = "default", size = "sm", className, children }: StatusBadgeProps) {
  return (
    <Badge
      color={tone}
      variant="soft"
      size={size}
      // Badge defaults to absolute corner placement (notification-dot style);
      // we use it inline, so reset that.
      className={cn("static translate-x-0 translate-y-0 transform-none px-2", className)}
    >
      {children}
    </Badge>
  );
}

/** Map a MedVerify check status ("safe" | "caution" | "unsafe") to a badge tone. */
export function medverifyTone(status: string): StatusTone {
  if (status === "safe") return "success";
  if (status === "caution") return "warning";
  if (status === "unsafe") return "danger";
  return "default";
}
