import { useTranslation } from "react-i18next";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarPlus,
  Pill,
  CalendarDays,
  Activity,
  Bot,
  HeartPulse,
  Clock,
  ArrowRight,
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
            <CalendarPlus className="mr-2 h-4 w-4" /> {t("dashboard.bookAppointment", "Book appointment")}
          </Button>
        </Link>
      }
    >
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Upcoming appointments */}
        <section className="soma-card p-6 lg:col-span-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-lg font-semibold">{t("dashboard.upcomingAppointments", "Upcoming appointments")}</h2>
              <p className="text-xs text-muted-foreground">{t("dashboard.upcomingAppointmentsSubtitle", "Your next visits")}</p>
            </div>
            <Link to="/appointments" className="text-xs text-primary hover:underline">
              {t("dashboard.viewAll", "View all")}
            </Link>
          </div>
          <div className="mt-6 space-y-4">
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
                body={t("dashboard.noAppointmentsBody", "Book your next visit — in-person or telehealth.")}
                action={
                  <Link to="/appointments">
                    <Button size="sm" className="soma-gradient soma-glow border-0 text-white">
                      <CalendarPlus className="mr-2 h-4 w-4" /> {t("dashboard.bookAppointment", "Book")}
                    </Button>
                  </Link>
                }
              />
            )}
          </div>
        </section>

        {/* Glucose chart */}
        <section className="soma-card p-6 lg:col-span-7">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-lg font-semibold">
                {t("dashboard.recentResults", "Recent results")} <span className="text-muted-foreground font-normal">· {t("dashboard.glucose", "Glucose")}</span>
              </h2>
              <p className="text-xs text-muted-foreground">{t("dashboard.last7Days", "Last 7 days")}</p>
            </div>
            <Link to="/trackers/vitals" className="text-xs text-primary hover:underline">
              {t("dashboard.allVitals", "All vitals")}
            </Link>
          </div>
          <div className="mt-6 h-64">
            {vitals.isLoading ? (
              <Skeleton className="h-full w-full" />
            ) : vitals.data && vitals.data.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={vitals.data.map((v) => ({
                  label: format(new Date(v.taken_at), "EEE"),
                  value: Number(v.value),
                }))}>
                  <defs>
                    <linearGradient id="glucose" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="label" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
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
                    <Button size="sm" variant="outline">{t("dashboard.logReading", "Log a reading")}</Button>
                  </Link>
                }
              />
            )}
          </div>
        </section>

        {/* AI shortcut */}
        <section className="soma-card p-6 lg:col-span-5 relative overflow-hidden">
          <div className="absolute inset-0 -z-10 soma-gradient opacity-95" />
          <div className="text-white">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-white/80">
              <Bot className="h-4 w-4" /> {t("assistant.brandName", "Adwoa AI")}
            </div>
            <h2 className="mt-3 font-display text-2xl font-bold">
              {t("dashboard.aiShortcutTitle", "Ask about your health — grounded in your data.")}
            </h2>
            <p className="mt-2 text-sm text-white/85">
              {t("dashboard.aiShortcutBody", "Symptoms, meds, reports and images. Multilingual, private, always available.")}
            </p>
            <Link to="/assistant">
              <Button className="mt-6 bg-white text-primary hover:bg-white/90">
                {t("dashboard.openAssistant", "Open assistant")} <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </section>

        {/* Current prescription */}
        <section className="soma-card p-6 lg:col-span-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-lg font-semibold">{t("dashboard.currentPrescription", "Current prescription")}</h2>
              <p className="text-xs text-muted-foreground">{t("dashboard.activeMedications", "Active medications")}</p>
            </div>
            <Link to="/medications" className="text-xs text-primary hover:underline">
              {t("dashboard.manage", "Manage")}
            </Link>
          </div>
          <div className="mt-6 space-y-4">
            {medications.isLoading ? (
              <Skeleton className="h-20 w-full" />
            ) : medications.data && medications.data.length > 0 ? (
              medications.data.map((m) => (
                <div key={m.id} className="flex items-center gap-4">
                  <div className="h-10 w-10 shrink-0 rounded-full soma-gradient soma-glow" />
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
                body={t("dashboard.noMedicationsBody", "Add your prescriptions to get reminders and interaction checks.")}
                action={
                  <Link to="/medications">
                    <Button size="sm" variant="outline">{t("dashboard.addMedication", "Add medication")}</Button>
                  </Link>
                }
              />
            )}
          </div>
        </section>

        {/* Notifications */}
        <section className="soma-card p-6 lg:col-span-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">{t("dashboard.notifications", "Notifications")}</h2>
          </div>
          <div className="mt-6 space-y-4">
            {notifications.isLoading ? (
              <Skeleton className="h-16 w-full" />
            ) : notifications.data && notifications.data.length > 0 ? (
              notifications.data.map((n) => (
                <div key={n.id} className="flex items-start gap-3">
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
  const when = isToday(d) ? t("dashboard.today", "Today") : isTomorrow(d) ? t("dashboard.tomorrow", "Tomorrow") : format(d, "MMM d");
  const initials = appt.provider_name.split(" ").slice(-1)[0]?.slice(0, 2).toUpperCase() || "DR";

  return (
    <div className="flex items-center gap-4">
      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full soma-gradient text-white text-sm font-semibold soma-glow">
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
