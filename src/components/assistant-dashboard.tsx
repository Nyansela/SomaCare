import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  HeartPulse,
  Pill,
  CalendarDays,
  Clock,
  TrendingDown,
  TrendingUp,
  Minus,
  CheckCircle2,
  Circle,
  Loader2,
  Activity,
} from "lucide-react";
import { format, isToday, isTomorrow } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Compact health dashboard sidebar for the assistant page.
 * Shows latest vitals, today's medications, and upcoming appointments
 * in a condensed scrollable panel.
 */
export function AssistantDashboard() {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">Health Overview</span>
        </div>
        <Link
          to="/app"
          className="text-[11px] font-medium text-primary hover:underline"
        >
          Full dashboard
        </Link>
      </div>

      {/* Scrollable cards */}
      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        <LatestVitalsCard />
        <MedicationsCard />
        <AppointmentsCard />
      </div>
    </div>
  );
}

// ── Latest Vitals ───────────────────────────────────────────────────────

function LatestVitalsCard() {
  const latestVitals = useQuery({
    queryKey: ["vitals", "latest"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vitals")
        .select("kind,value,unit,taken_at")
        .order("taken_at", { ascending: false })
        .limit(60);
      if (error) throw error;
      return data;
    },
  });

  const byKind = new Map<
    string,
    { unit: string | null; takenAt: string; history: number[] }
  >();
  if (latestVitals.data) {
    for (const v of latestVitals.data) {
      const entry = byKind.get(v.kind);
      if (entry) entry.history.push(Number(v.value));
      else
        byKind.set(v.kind, {
          unit: v.unit,
          takenAt: v.taken_at,
          history: [Number(v.value)],
        });
    }
  }

  const trend = (h: number[]) => {
    if (h.length < 4) return null;
    const half = Math.floor(h.length / 2);
    const newer = h.slice(0, half);
    const older = h.slice(half);
    const avg = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;
    const diff = avg(newer) - avg(older);
    const base = avg(older);
    if (base === 0 || Math.abs(diff) < 0.05 * base) return "flat";
    return diff < 0 ? "down" : "up";
  };

  return (
    <div className="rounded-xl border border-border/60 bg-card/50 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground">
          Latest Vitals
        </span>
        <Link
          to="/trackers/vitals"
          className="text-[10px] font-medium text-primary hover:underline"
        >
          All
        </Link>
      </div>
      {latestVitals.isLoading ? (
        <Skeleton className="h-16 w-full" />
      ) : [...byKind.entries()].length > 0 ? (
        <div className="space-y-2">
          {[...byKind.entries()].slice(0, 4).map(([kind, info]) => {
            const t = trend(info.history);
            return (
              <div key={kind} className="flex items-center justify-between">
                <div className="min-w-0">
                  <div className="truncate text-xs font-medium capitalize">
                    {kind.replace(/_/g, " ")}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {format(new Date(info.takenAt), "MMM d, p")}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <span className="text-xs font-semibold">
                    {info.history[0]}
                    {info.unit ? ` ${info.unit}` : ""}
                  </span>
                  {t === "down" ? (
                    <TrendingDown className="h-3 w-3 text-emerald-500" />
                  ) : t === "up" ? (
                    <TrendingUp className="h-3 w-3 text-destructive" />
                  ) : t === "flat" ? (
                    <Minus className="h-3 w-3 text-muted-foreground" />
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="py-2 text-center text-[11px] text-muted-foreground">
          No readings yet
        </div>
      )}
    </div>
  );
}

// ── Today's Medications ─────────────────────────────────────────────────

function MedicationsCard() {
  const medications = useQuery({
    queryKey: ["medications", "active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("medications")
        .select("*")
        .eq("active", true)
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data;
    },
  });

  const todayKey = format(new Date(), "yyyy-MM-dd");
  const doseLogs = useQuery({
    queryKey: ["medication_dose_logs", todayKey],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("medication_dose_logs")
        .select("medication_id")
        .eq("taken_on", todayKey);
      if (error) throw error;
      return new Set((data ?? []).map((d) => d.medication_id));
    },
  });

  return (
    <div className="rounded-xl border border-border/60 bg-card/50 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground">
          Medications
        </span>
        <Link
          to="/medications"
          className="text-[10px] font-medium text-primary hover:underline"
        >
          Manage
        </Link>
      </div>
      {medications.isLoading || doseLogs.isLoading ? (
        <Skeleton className="h-12 w-full" />
      ) : medications.data && medications.data.length > 0 ? (
        <div className="space-y-1.5">
          {medications.data.map((m) => {
            const taken = doseLogs.data?.has(m.id) ?? false;
            return (
              <div
                key={m.id}
                className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition hover:bg-muted/30"
              >
                {taken ? (
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                ) : (
                  <Circle className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                )}
                <div className="min-w-0 flex-1">
                  <div
                    className={`truncate text-xs ${taken ? "text-muted-foreground line-through" : "font-medium"}`}
                  >
                    {m.name}
                  </div>
                </div>
                <span
                  className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${taken ? "bg-emerald-500/15 text-emerald-600" : "bg-muted text-muted-foreground"}`}
                >
                  {taken ? "✓" : "Due"}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="py-2 text-center text-[11px] text-muted-foreground">
          No medications
        </div>
      )}
    </div>
  );
}

// ── Upcoming Appointments ───────────────────────────────────────────────

function AppointmentsCard() {
  const appointments = useQuery({
    queryKey: ["appointments", "upcoming"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("*")
        .gte("starts_at", new Date().toISOString())
        .in("status", ["scheduled", "confirmed"])
        .order("starts_at")
        .limit(3);
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="rounded-xl border border-border/60 bg-card/50 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground">
          Appointments
        </span>
        <Link
          to="/appointments"
          className="text-[10px] font-medium text-primary hover:underline"
        >
          View all
        </Link>
      </div>
      {appointments.isLoading ? (
        <Skeleton className="h-12 w-full" />
      ) : appointments.data && appointments.data.length > 0 ? (
        <div className="space-y-2">
          {appointments.data.map((a) => {
            const d = new Date(a.starts_at);
            const when = isToday(d)
              ? "Today"
              : isTomorrow(d)
                ? "Tomorrow"
                : format(d, "MMM d");
            const initials =
              a.provider_name.split(" ").slice(-1)[0]?.slice(0, 2).toUpperCase() ||
              "DR";
            return (
              <div key={a.id} className="flex items-center gap-2">
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full soma-gradient text-[10px] font-semibold text-white soma-glow">
                  {a.provider_avatar_url ? (
                    <img
                      src={a.provider_avatar_url}
                      alt=""
                      className="h-full w-full rounded-full object-cover"
                    />
                  ) : (
                    initials
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-medium">
                    {a.provider_name}
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-0.5">
                      <CalendarDays className="h-2.5 w-2.5" /> {when}
                    </span>
                    <span className="flex items-center gap-0.5">
                      <Clock className="h-2.5 w-2.5" /> {format(d, "p")}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="py-2 text-center text-[11px] text-muted-foreground">
          No upcoming appointments
        </div>
      )}
    </div>
  );
}
