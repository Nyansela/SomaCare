import { useTranslation } from "react-i18next";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarPlus,
  Pill,
  CalendarDays,
  Activity,
  Bot,
  HeartPulse,
  Clock,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  Minus,
  CheckCircle2,
  Circle,
  ClipboardList,
  Loader2,
} from "lucide-react";
import { format, isToday, isTomorrow } from "date-fns";
import {
  LineChart,
  Line,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, EmptyState } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/app")({
  head: () => ({
    meta: [
      { title: "Dashboard — SomaCare" },
      { name: "description", content: "Your personalized health dashboard." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const appointments = useQuery({
    queryKey: ["appointments", "upcoming"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("*")
        .gte("starts_at", new Date().toISOString())
        .in("status", ["scheduled", "confirmed"])
        .order("starts_at")
        .limit(4);
      if (error) throw error;
      return data;
    },
  });

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

  const vitals = useQuery({
    queryKey: ["vitals", "glucose", "7d"],
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - 7);
      const { data, error } = await supabase
        .from("vitals")
        .select("value, taken_at")
        .eq("kind", "glucose")
        .gte("taken_at", since.toISOString())
        .order("taken_at");
      if (error) throw error;
      return data;
    },
  });

  // Latest readings across ALL vital kinds (latest-per-kind card + trend)
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

  // Today's medication taken-status
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

  const toggleDose = useMutation({
    mutationFn: async ({ medId, taken }: { medId: string; taken: boolean }) => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not authenticated");
      if (taken) {
        const { error } = await supabase
          .from("medication_dose_logs")
          .delete()
          .eq("medication_id", medId)
          .eq("taken_on", todayKey);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("medication_dose_logs").insert({
          medication_id: medId,
          taken_on: todayKey,
          user_id: u.user.id,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["medication_dose_logs"] }),
  });

  // Active plan (workout preferred) for the dashboard plan card
  const activePlans = useQuery({
    queryKey: ["plans", "dashboard"],
    queryFn: async () => {
      const [w, m] = await Promise.all([
        supabase
          .from("workout_plans")
          .select("id,title,duration_days,start_date")
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .limit(1),
        supabase
          .from("meal_plans")
          .select("id,title,duration_days,start_date")
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .limit(1),
      ]);
      if (w.error) throw w.error;
      if (m.error) throw m.error;
      const plan = (w.data ?? [])[0] ?? (m.data ?? [])[0];
      if (!plan) return null;
      const start = new Date(`${plan.start_date}T00:00:00`);
      const dayNumber = Math.min(
        Math.max(Math.floor((Date.now() - start.getTime()) / 86400000) + 1, 1),
        plan.duration_days,
      );
      const [{ data: done }, daysTable] = await Promise.all([
        supabase
          .from("plan_day_completions")
          .select("day_number")
          .eq("plan_id", plan.id),
        "duration_days" in plan && w.data?.length ? supabase.from("workout_plan_days") : null,
      ]);
      let todaySummary = "";
      if (daysTable) {
        const { data: dayRows } = await daysTable
          .select("exercises")
          .eq("plan_id", plan.id)
          .eq("day_number", dayNumber)
          .maybeSingle();
        const exercises = ((dayRows?.exercises as Array<{ name: string }> | null) ?? []).slice(0, 3);
        todaySummary = exercises.map((e) => e.name).join(", ");
      }
      const doneSet = new Set((done ?? []).map((d) => d.day_number));
      return {
        id: plan.id,
        title: plan.title,
        durationDays: plan.duration_days,
        dayNumber,
        doneToday: doneSet.has(dayNumber),
        doneCount: doneSet.size,
        todaySummary,
      };
    },
  });

  const markPlanDone = useMutation({
    mutationFn: async () => {
      const plan = activePlans.data;
      if (!plan) return;
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not authenticated");
      const { error } = await supabase.from("plan_day_completions").upsert({
        plan_id: plan.id,
        plan_type: "workout",
        day_number: plan.dayNumber,
        user_id: u.user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["plans"] }),
  });

  const notifications = useQuery({
    queryKey: ["notifications", "recent"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data;
    },
  });

  return (
    <AppShell
      title={t("dashboard.title", "Dashboard")}
      subtitle={format(new Date(), "EEEE, MMMM d")}
      action={
        <Link to="/appointments">
          <Button className="soma-gradient soma-glow border-0 text-white hidden sm:inline-flex">
            <CalendarPlus className="mr-2 h-4 w-4" />{" "}
            {t("dashboard.bookAppointment", "Book appointment")}
          </Button>
        </Link>
      }
    >
      {/* Compact quick actions */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="mr-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Quick actions
        </span>
        <Link to="/trackers/vitals">
          <Button size="sm" variant="outline" className="h-8 text-xs">
            <Activity className="mr-1 h-3.5 w-3.5" /> Log reading
          </Button>
        </Link>
        <Link to="/appointments">
          <Button size="sm" variant="outline" className="h-8 text-xs">
            <CalendarPlus className="mr-1 h-3.5 w-3.5" /> Book appointment
          </Button>
        </Link>
        <Link to="/medications">
          <Button size="sm" variant="outline" className="h-8 text-xs">
            <Pill className="mr-1 h-3.5 w-3.5" /> Add medication
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-12 lg:gap-6">
        {/* Latest vitals + trend */}
        <section className="soma-card p-3.5 sm:p-5 lg:col-span-4">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <h2 className="truncate font-display text-base font-semibold sm:text-lg">Latest readings</h2>
              <p className="text-xs text-muted-foreground">From your Health Vault</p>
            </div>
            <Link to="/trackers/vitals" className="shrink-0 text-xs text-primary hover:underline">
              All vitals
            </Link>
          </div>
          <div className="mt-3 space-y-2.5 sm:mt-4">
            {latestVitals.isLoading ? (
              <Skeleton className="h-20 w-full" />
            ) : latestVitals.data && latestVitals.data.length > 0 ? (
              (() => {
                const byKind = new Map<
                  string,
                  { unit: string | null; takenAt: string; history: number[] }
                >();
                for (const v of latestVitals.data) {
                  const entry = byKind.get(v.kind);
                  if (entry) {
                    entry.history.push(Number(v.value));
                  } else {
                    byKind.set(v.kind, {
                      unit: v.unit,
                      takenAt: v.taken_at,
                      history: [Number(v.value)],
                    });
                  }
                }
                return [...byKind.entries()].slice(0, 5).map(([kind, info]) => {
                  const trend = vitalTrend(info.history);
                  return (
                    <div key={kind} className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium capitalize">
                          {kind.replace(/_/g, " ")}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {format(new Date(info.takenAt), "MMM d, p")}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="text-sm font-semibold">
                          {info.history[0]}
                          {info.unit ? ` ${info.unit}` : ""}
                        </span>
                        {trend === "down" ? (
                          <TrendingDown className="h-4 w-4 text-emerald-500" aria-label="trending down" />
                        ) : trend === "up" ? (
                          <TrendingUp className="h-4 w-4 text-destructive" aria-label="trending up" />
                        ) : trend === "flat" ? (
                          <Minus className="h-4 w-4 text-muted-foreground" aria-label="stable" />
                        ) : null}
                      </div>
                    </div>
                  );
                });
              })()
            ) : (
              <EmptyState
                icon={HeartPulse}
                title={t("dashboard.noReadings", "No readings yet")}
                body={t(
                  "dashboard.noReadingsBody",
                  "Tap to add your first reading and start spotting trends.",
                )}
                action={
                  <Link to="/trackers/vitals">
                    <Button size="sm" variant="outline">
                      {t("dashboard.logReading", "Log a reading")}
                    </Button>
                  </Link>
                }
              />
            )}
          </div>
        </section>

        {/* Today's medication schedule with taken/not-taken status */}
        <section className="soma-card p-3.5 sm:p-5 lg:col-span-4">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <h2 className="truncate font-display text-base font-semibold sm:text-lg">Today's medications</h2>
              <p className="text-xs text-muted-foreground">Tap to mark as taken</p>
            </div>
            <Link to="/medications" className="shrink-0 text-xs text-primary hover:underline">
              Manage
            </Link>
          </div>
          <div className="mt-4 space-y-2">
            {medications.isLoading || doseLogs.isLoading ? (
              <Skeleton className="h-16 w-full" />
            ) : medications.data && medications.data.length > 0 ? (
              medications.data.map((m) => {
                const taken = doseLogs.data?.has(m.id) ?? false;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => toggleDose.mutate({ medId: m.id, taken })}
                    className="flex w-full items-center gap-3 rounded-xl border border-border/70 bg-background/50 px-3 py-2 text-left transition hover:border-primary/40"
                  >
                    {taken ? (
                      <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
                    ) : (
                      <Circle className="h-5 w-5 shrink-0 text-muted-foreground" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className={`truncate text-sm ${taken ? "text-muted-foreground line-through" : "font-medium"}`}>
                        {m.name}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {[m.dose, m.scheduled_time?.slice(0, 5), m.frequency].filter(Boolean).join(" · ") || "No schedule"}
                      </div>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${taken ? "bg-emerald-500/15 text-emerald-600" : "bg-muted text-muted-foreground"}`}>
                      {taken ? "Taken" : "Not taken"}
                    </span>
                  </button>
                );
              })
            ) : (
              <EmptyState
                icon={Pill}
                title={t("dashboard.noMedications", "No medications yet")}
                body={t(
                  "dashboard.noMedicationsBody",
                  "Add your prescriptions to get reminders and interaction checks.",
                )}
                action={
                  <Link to="/medications">
                    <Button size="sm" variant="outline">
                      {t("dashboard.addMedication", "Add medication")}
                    </Button>
                  </Link>
                }
              />
            )}
          </div>
        </section>

        {/* Active plan progress */}
        {activePlans.data && (
          <section className="soma-card p-3.5 sm:p-5 lg:col-span-4">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <h2 className="truncate font-display text-base font-semibold sm:text-lg">
                  {activePlans.data.title}
                </h2>
                <p className="text-xs text-muted-foreground">AI-generated plan in progress</p>
              </div>
              <Link to="/plans" className="shrink-0 text-xs text-primary hover:underline">
                My Plans
              </Link>
            </div>
            <div className="mt-4 rounded-2xl border border-border/70 bg-muted/30 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <ClipboardList className="h-4 w-4 text-primary" />
                  <span className="font-semibold text-sm">
                    Day {activePlans.data.dayNumber} of {activePlans.data.durationDays}
                  </span>
                </div>
                <Button
                  size="sm"
                  variant={activePlans.data.doneToday ? "outline" : "default"}
                  disabled={activePlans.data.doneToday || markPlanDone.isPending}
                  onClick={() => markPlanDone.mutate()}
                  className={cn(activePlans.data.doneToday ? "" : "soma-gradient soma-glow border-0 text-white", "gap-1.5")}
                >
                  {markPlanDone.isPending && !activePlans.data.doneToday ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : activePlans.data.doneToday ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  {activePlans.data.doneToday ? "Done today" : "Complete"}
                </Button>
              </div>
              {activePlans.data.todaySummary && (
                <p className="mt-2 truncate text-xs text-muted-foreground">
                  Today: {activePlans.data.todaySummary}
                </p>
              )}
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-background">
                <div
                  className="h-full rounded-full soma-gradient"
                  style={{
                    width: `${Math.round((activePlans.data.doneCount / activePlans.data.durationDays) * 100)}%`,
                  }}
                />
              </div>
            </div>
          </section>
        )}

        {/* Upcoming appointments */}
        <section className="soma-card p-3.5 sm:col-span-2 sm:p-5 lg:col-span-5">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <h2 className="truncate font-display text-base font-semibold sm:text-lg">
                {t("dashboard.upcomingAppointments", "Upcoming appointments")}
              </h2>
              <p className="text-xs text-muted-foreground">
                {t("dashboard.upcomingAppointmentsSubtitle", "Your next visits")}
              </p>
            </div>
            <Link to="/appointments" className="shrink-0 text-xs text-primary hover:underline">
              {t("dashboard.viewAll", "View all")}
            </Link>
          </div>
          <div className="mt-3 space-y-3 sm:mt-6 sm:space-y-4">
            {appointments.isLoading ? (
              <>
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </>
            ) : appointments.data && appointments.data.length > 0 ? (
              appointments.data.map((a) => <AppointmentRow key={a.id} appt={a} />)
            ) : (
              <EmptyState
                icon={CalendarDays}
                title={t("dashboard.noAppointments", "No upcoming appointments")}
                body={t(
                  "dashboard.noAppointmentsBody",
                  "Book your next visit — in-person or telehealth.",
                )}
                action={
                  <Link to="/appointments">
                    <Button size="sm" className="soma-gradient soma-glow border-0 text-white">
                      <CalendarPlus className="mr-2 h-4 w-4" />{" "}
                      {t("dashboard.bookAppointment", "Book")}
                    </Button>
                  </Link>
                }
              />
            )}
          </div>
        </section>

        {/* Glucose chart */}
        <section className="soma-card p-3.5 sm:col-span-2 sm:p-5 lg:col-span-7">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <h2 className="truncate font-display text-base font-semibold sm:text-lg">
                {t("dashboard.recentResults", "Recent results")}{" "}
                <span className="text-muted-foreground font-normal">
                  · {t("dashboard.glucose", "Glucose")}
                </span>
              </h2>
              <p className="text-xs text-muted-foreground">
                {t("dashboard.last7Days", "Last 7 days")}
              </p>
            </div>
            <Link to="/trackers/vitals" className="shrink-0 text-xs text-primary hover:underline">
              {t("dashboard.allVitals", "All vitals")}
            </Link>
          </div>
          <div className="mt-3 h-40 sm:mt-6 sm:h-64">
            {vitals.isLoading ? (
              <Skeleton className="h-full w-full" />
            ) : vitals.data && vitals.data.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={vitals.data.map((v) => ({
                    label: format(new Date(v.taken_at), "EEE"),
                    value: Number(v.value),
                  }))}
                >
                  <defs>
                    <linearGradient id="glucose" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis
                    dataKey="label"
                    stroke="var(--muted-foreground)"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="var(--muted-foreground)"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: "0.75rem",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="var(--primary)"
                    strokeWidth={2.5}
                    dot={{ fill: "var(--primary)", r: 4 }}
                    activeDot={{ r: 6 }}
                    fill="url(#glucose)"
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState
                icon={Activity}
                title={t("dashboard.noGlucose", "No glucose readings yet")}
                body={t("dashboard.noGlucoseBody", "Log your first vital to start seeing trends.")}
                action={
                  <Link to="/trackers/vitals">
                    <Button size="sm" variant="outline">
                      {t("dashboard.logReading", "Log a reading")}
                    </Button>
                  </Link>
                }
              />
            )}
          </div>
        </section>

        {/* AI shortcut */}
        <section className="soma-card relative overflow-hidden p-3.5 sm:col-span-2 sm:p-5 lg:col-span-5">
          <div className="absolute inset-0 -z-10 soma-gradient opacity-95" />
          <div className="text-white">
            <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-white/80 sm:text-xs">
              <Bot className="h-4 w-4" /> {t("assistant.brandName", "Adwoa AI")}
            </div>
            <h2 className="mt-1.5 font-display text-lg font-bold sm:mt-3 sm:text-2xl">
              {t("dashboard.aiShortcutTitle", "Ask about your health — grounded in your data.")}
            </h2>
            <p className="mt-1 text-xs text-white/85 sm:mt-2 sm:text-sm">
              {t(
                "dashboard.aiShortcutBody",
                "Symptoms, meds, reports and images. Multilingual, private, always available.",
              )}
            </p>
            <Link to="/assistant">
              <Button className="mt-3 bg-white text-primary hover:bg-white/90 sm:mt-6" size="sm">
                {t("dashboard.openAssistant", "Open assistant")}{" "}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </section>

        {/* Current prescription */}
        <section className="soma-card p-3.5 sm:p-5 lg:col-span-4">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <h2 className="truncate font-display text-base font-semibold sm:text-lg">
                {t("dashboard.currentPrescription", "Current prescription")}
              </h2>
              <p className="text-xs text-muted-foreground">
                {t("dashboard.activeMedications", "Active medications")}
              </p>
            </div>
            <Link to="/medications" className="shrink-0 text-xs text-primary hover:underline">
              {t("dashboard.manage", "Manage")}
            </Link>
          </div>
          <div className="mt-3 space-y-3 sm:mt-6 sm:space-y-4">
            {medications.isLoading ? (
              <Skeleton className="h-20 w-full" />
            ) : medications.data && medications.data.length > 0 ? (
              medications.data.map((m) => (
                <div key={m.id} className="flex items-center gap-3 sm:gap-4">
                  <div className="h-9 w-9 shrink-0 rounded-full soma-gradient soma-glow sm:h-10 sm:w-10" />
                  <div className="min-w-0">
                    <div className="font-semibold text-sm truncate">{m.name}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {[m.dose, m.frequency].filter(Boolean).join(" · ") || "No schedule"}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <EmptyState
                icon={Pill}
                title={t("dashboard.noMedications", "No medications yet")}
                body={t(
                  "dashboard.noMedicationsBody",
                  "Add your prescriptions to get reminders and interaction checks.",
                )}
                action={
                  <Link to="/medications">
                    <Button size="sm" variant="outline">
                      {t("dashboard.addMedication", "Add medication")}
                    </Button>
                  </Link>
                }
              />
            )}
          </div>
        </section>

        {/* Notifications */}
        <section className="soma-card p-3.5 sm:p-5 lg:col-span-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-semibold sm:text-lg">
              {t("dashboard.notifications", "Notifications")}
            </h2>
          </div>
          <div className="mt-3 space-y-2.5 sm:mt-6 sm:space-y-4">
            {notifications.isLoading ? (
              <Skeleton className="h-16 w-full" />
            ) : notifications.data && notifications.data.length > 0 ? (
              notifications.data.map((n) => (
                <div key={n.id} className="flex items-start gap-2 sm:gap-3">
                  <span
                    className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${
                      n.severity === "danger"
                        ? "bg-destructive"
                        : n.severity === "warning"
                          ? "bg-[var(--warning)]"
                          : n.severity === "success"
                            ? "bg-[var(--success)]"
                            : "bg-primary"
                    }`}
                  />
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{n.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {format(new Date(n.created_at), "MMM d")}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <EmptyState
                icon={HeartPulse}
                title={t("dashboard.caughtUp", "You're all caught up")}
                body={t("dashboard.caughtUpBody", "Alerts and reminders will show up here.")}
              />
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
}

/** Compare newest-first readings: returns trend of recent half vs older half */
function vitalTrend(historyNewestFirst: number[]): "up" | "down" | "flat" | null {
  if (historyNewestFirst.length < 4) return null;
  const half = Math.floor(historyNewestFirst.length / 2);
  const newer = historyNewestFirst.slice(0, half);
  const older = historyNewestFirst.slice(half);
  const avg = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;
  const diff = avg(newer) - avg(older);
  const base = avg(older);
  if (base === 0 || Math.abs(diff) < 0.05 * base) return "flat";
  return diff < 0 ? "down" : "up";
}

function AppointmentRow({
  appt,
}: {
  appt: {
    id: string;
    provider_name: string;
    specialty: string | null;
    starts_at: string;
    provider_avatar_url: string | null;
  };
}) {
  const { t } = useTranslation();
  const d = new Date(appt.starts_at);
  const when = isToday(d)
    ? t("dashboard.today", "Today")
    : isTomorrow(d)
      ? t("dashboard.tomorrow", "Tomorrow")
      : format(d, "MMM d");
  const initials = appt.provider_name.split(" ").slice(-1)[0]?.slice(0, 2).toUpperCase() || "DR";

  return (
    <div className="flex items-center gap-3 sm:gap-4">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full soma-gradient text-white text-sm font-semibold soma-glow sm:h-12 sm:w-12">
        {appt.provider_avatar_url ? (
          <img
            src={appt.provider_avatar_url}
            alt=""
            className="h-full w-full rounded-full object-cover"
          />
        ) : (
          initials
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-semibold text-sm truncate">{appt.provider_name}</div>
        {appt.specialty && (
          <div className="text-xs text-muted-foreground truncate">{appt.specialty}</div>
        )}
        <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <CalendarDays className="h-3 w-3 text-primary" /> {when}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3 text-primary" /> {format(d, "p")}
          </span>
        </div>
      </div>
    </div>
  );
}
