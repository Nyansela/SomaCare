import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  LayoutDashboard,
  Bot,
  FileText,
  CalendarDays,
  Pill,
  Activity,
  MapPin,
  Siren,
  Settings,
  LogOut,
  Bell,
  Menu,
  Stethoscope,
  Plus,
  ShoppingBag,
  Clock,
  UtensilsCrossed,
  Moon,
  Droplets,
  Dumbbell,
  Calendar,
  ChevronDown,
} from "lucide-react";
import { motion, MotionConfig } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ThemeCustomizer } from "@/components/theme-customizer";

const navGroups = [
  {
    labelKey: "nav.overview",
    fallbackLabel: "Overview",
    items: [
      { to: "/app", labelKey: "nav.dashboard", fallbackLabel: "Dashboard", icon: LayoutDashboard },
      { to: "/assistant", labelKey: "nav.assistant", fallbackLabel: "AI Assistant", icon: Bot },
    ],
  },
  {
    labelKey: "nav.health",
    fallbackLabel: "Health",
    items: [
      { to: "/trackers/vitals", labelKey: "nav.vitals", fallbackLabel: "Vitals", icon: Activity },
      { to: "/medications", labelKey: "nav.medications", fallbackLabel: "Medications", icon: Pill },
      { to: "/records", labelKey: "nav.records", fallbackLabel: "Records", icon: FileText },
      {
        to: "/health-vault",
        labelKey: "nav.healthVault",
        fallbackLabel: "Health Vault",
        icon: Stethoscope,
      },
    ],
  },
  {
    labelKey: "nav.wellness",
    fallbackLabel: "Wellness",
    items: [
      {
        to: "/nutrition",
        labelKey: "nav.nutrition",
        fallbackLabel: "Nutrition",
        icon: UtensilsCrossed,
      },
      { to: "/sleep", labelKey: "nav.sleep", fallbackLabel: "Sleep", icon: Moon },
      { to: "/hydration", labelKey: "nav.hydration", fallbackLabel: "Hydration", icon: Droplets },
      { to: "/fitness", labelKey: "nav.fitness", fallbackLabel: "Fitness", icon: Dumbbell },
    ],
  },
  {
    labelKey: "nav.planning",
    fallbackLabel: "Planning",
    items: [
      { to: "/schedule", labelKey: "nav.schedule", fallbackLabel: "Schedule", icon: Calendar },
      {
        to: "/appointments",
        labelKey: "nav.appointments",
        fallbackLabel: "Appointments",
        icon: CalendarDays,
      },
      { to: "/clock", labelKey: "nav.clock", fallbackLabel: "Clock", icon: Clock },
    ],
  },
  {
    labelKey: "nav.care",
    fallbackLabel: "Care & More",
    items: [
      {
        to: "/find/hospitals",
        labelKey: "nav.hospitals",
        fallbackLabel: "Find care",
        icon: MapPin,
      },
      { to: "/emergency", labelKey: "nav.emergency", fallbackLabel: "Emergency", icon: Siren },
      { to: "/store", labelKey: "nav.store", fallbackLabel: "Store", icon: ShoppingBag },
    ],
  },
] as const;

export function AppShell({
  children,
  title,
  subtitle,
  action,
}: {
  children: ReactNode;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [profile, setProfile] = useState<{
    name: string;
    email: string;
    avatar?: string | null;
  } | null>(null);
  const [open, setOpen] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const toggleGroup = (label: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data: p } = await supabase
        .from("profiles")
        .select("display_name, avatar_url")
        .eq("id", u.user.id)
        .maybeSingle();
      setProfile({
        name: p?.display_name || u.user.email?.split("@")[0] || "You",
        email: u.user.email || "",
        avatar: p?.avatar_url,
      });
    })();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen bg-background">
        {/* Shared gradient accent - replaces page-specific gradients */}
        <div aria-hidden className="soma-glow-top pointer-events-none absolute inset-x-0 top-0" />
        {/* Sidebar */}
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-40 border-r border-border bg-sidebar transition-transform lg:translate-x-0 flex flex-col",
            "w-[var(--layout-sidebar)]",
            open ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <div className="flex h-16 items-center gap-2 px-6">
            <Link to="/app" className="flex items-center gap-2">
              <img
                src="/images/branding/logo.svg"
                alt={t("nav.logoAlt", "SomaCare Logo")}
                className="h-9 w-auto"
              />
            </Link>
          </div>
          <nav className="mt-2 px-3 overflow-y-auto flex-1 pb-4">
            {navGroups.map((group) => {
              const groupLabel = t(group.labelKey, group.fallbackLabel);
              const isCollapsed = collapsedGroups.has(group.labelKey);
              return (
                <div key={group.labelKey} className="mb-3">
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.labelKey)}
                    aria-expanded={!isCollapsed}
                    className="flex w-full items-center justify-between px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 transition hover:text-foreground"
                  >
                    {groupLabel}
                    <ChevronDown
                      className={cn(
                        "h-3.5 w-3.5 transition-transform",
                        isCollapsed && "-rotate-90",
                      )}
                    />
                  </button>
                  {!isCollapsed && (
                    <div className="space-y-0.5">
                      {group.items.map((item) => {
                        const itemLabel = t(item.labelKey, item.fallbackLabel);
                        const active =
                          location.pathname === item.to ||
                          (item.to !== "/app" && location.pathname.startsWith(item.to));
                        return (
                          <Link
                            key={item.to}
                            to={item.to}
                            onClick={() => setOpen(false)}
                            className={cn(
                              "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition",
                              active
                                ? "bg-accent text-primary shadow-[var(--shadow-glow-primary)]"
                                : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                            )}
                          >
                            <item.icon className="h-4 w-4" />
                            {itemLabel}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
          <div className="border-t pt-3 mt-auto space-y-1 px-3 pb-4">
            <Link
              to="/settings"
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <Settings className="h-4 w-4" /> {t("nav.settings", "Settings")}
            </Link>
            <button
              onClick={signOut}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <LogOut className="h-4 w-4" /> {t("nav.signOut", "Sign out")}
            </button>
          </div>
        </aside>

        {/* Content */}
        <div className="lg:pl-[var(--layout-sidebar)]">
          <header className="sticky top-0 z-30 flex h-[var(--layout-header)] items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur md:px-8">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setOpen((o) => !o)}
              aria-label={t("nav.openMenu", "Open menu")}
            >
              <Menu className="h-5 w-5" />
            </Button>
            <div className="min-w-0 flex-1">
              <h1 className="truncate font-display text-xl font-bold tracking-tight">{title}</h1>
              {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
            </div>
            {action}
            <HeaderClock />
            <ThemeCustomizer />
            <Button
              variant="ghost"
              size="icon"
              className="relative"
              aria-label={t("nav.notifications", "Notifications")}
            >
              <Bell className="h-5 w-5" />
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-destructive" />
            </Button>
            <Avatar className="h-9 w-9">
              <AvatarImage src={profile?.avatar || undefined} />
              <AvatarFallback
                className="soma-gradient text-white text-xs font-semibold"
                aria-label={t("nav.profile", "Profile")}
              >
                {profile?.name?.slice(0, 2).toUpperCase() || t("nav.you", "You")}
              </AvatarFallback>
            </Avatar>
          </header>

          <motion.main
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="p-[var(--layout-pad)] md:p-[var(--layout-pad-lg)]"
          >
            {children}
          </motion.main>
        </div>

        {open && (
          <div
            className="fixed inset-0 z-30 bg-black/40 lg:hidden"
            onClick={() => setOpen(false)}
          />
        )}
      </div>
    </MotionConfig>
  );
}

function HeaderClock() {
  const { t } = useTranslation();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <Link
      to="/clock"
      className="hidden items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium tabular-nums text-muted-foreground transition hover:border-primary/40 hover:text-foreground md:inline-flex"
      aria-label={t("nav.openClock", "Open clock and reminders")}
    >
      <Clock className="h-3.5 w-3.5 text-primary" />
      {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
    </Link>
  );
}

export function EmptyState({
  icon: Icon = Plus,
  title,
  body,
  action,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border p-8 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-full bg-accent text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="mt-4 font-display text-base font-semibold">{title}</h3>
      {body && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
