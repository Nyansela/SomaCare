import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell,
  BellOff,
  Plus,
  Trash2,
  Clock as ClockIcon,
  Pill,
  Droplet,
  HeartPulse,
  Moon,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { LocalNotifications } from "@capacitor/local-notifications";
import { Capacitor } from "@capacitor/core";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/clock")({
  head: () => ({
    meta: [
      { title: "Clock & Reminders — SomaCare" },
      {
        name: "description",
        content: "Live world clock and health reminders for medications, hydration, and check-ins.",
      },
    ],
  }),
  component: ClockPage,
});

type Reminder = {
  id: string;
  label: string;
  time: string; // "HH:MM"
  icon: "pill" | "water" | "vitals" | "sleep" | "clock";
  repeat: "daily" | "weekdays" | "once";
  enabled: boolean;
};

const STORAGE_KEY = "soma.reminders.v1";
const ICONS = {
  pill: Pill,
  water: Droplet,
  vitals: HeartPulse,
  sleep: Moon,
  clock: ClockIcon,
};

function loadReminders(): Reminder[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}
function saveReminders(r: Reminder[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(r));
}

const CITIES = [
  { name: "Local", tz: undefined as string | undefined },
  { name: "New York", tz: "America/New_York" },
  { name: "London", tz: "Europe/London" },
  { name: "Dubai", tz: "Asia/Dubai" },
  { name: "Tokyo", tz: "Asia/Tokyo" },
];

function ClockPage() {
  const [now, setNow] = useState(() => new Date());
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const firedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    setReminders(loadReminders());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Reminder trigger (local session only)
  useEffect(() => {
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    const stamp = `${now.toDateString()}-${hh}:${mm}`;
    reminders.forEach((r) => {
      if (!r.enabled) return;
      const key = `${r.id}-${stamp}`;
      if (r.time === `${hh}:${mm}` && !firedRef.current.has(key)) {
        firedRef.current.add(key);
        toast(`⏰ ${r.label}`, {
          description: `Scheduled for ${r.time}`,
        });
        if (Capacitor.isNativePlatform()) {
          LocalNotifications.schedule({
            notifications: [
              {
                title: "Adwoa Reminder",
                body: r.label,
                id:
                  (Math.abs(
                    r.id.split("").reduce((a, c) => ((a << 5) - a + c.charCodeAt(0)) | 0, 0),
                  ) %
                    100000) +
                  2000,
                schedule: { at: new Date(Date.now() + 1000) },
              },
            ],
          }).catch(() => {});
        } else if ("Notification" in window && Notification.permission === "granted") {
          new Notification("Adwoa reminder", { body: r.label });
        }
      }
    });
  }, [now, reminders]);

  const update = (next: Reminder[]) => {
    setReminders(next);
    saveReminders(next);
  };

  const addReminder = (r: Omit<Reminder, "id" | "enabled">) => {
    const nr: Reminder = { ...r, id: crypto.randomUUID(), enabled: true };
    update([nr, ...reminders]);
    toast.success("Reminder added");
    if (Capacitor.isNativePlatform()) {
      LocalNotifications.checkPermissions()
        .then((perm) => {
          if (perm.display !== "granted") return LocalNotifications.requestPermissions();
        })
        .catch(() => {});
    } else if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  };

  const toggle = (id: string) =>
    update(reminders.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)));
  const remove = (id: string) => update(reminders.filter((r) => r.id !== id));

  const timeStr = now.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const dateStr = now.toLocaleDateString([], {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <AppShell
      title="Clock & Reminders"
      subtitle="Time zones, timers and health nudges — all in one place"
    >
      <div className="grid gap-6 lg:grid-cols-[1.15fr,1fr]">
        {/* Live clock hero */}
        <Card className="relative overflow-hidden">
          <div
            className="pointer-events-none absolute inset-0 opacity-70"
            style={{
              background:
                "radial-gradient(60% 60% at 50% 0%, var(--color-primary) 0%, transparent 60%)",
              filter: "blur(20px)",
            }}
          />
          <CardContent className="relative p-6">
            <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <span>Local time</span>
              <span>{Intl.DateTimeFormat().resolvedOptions().timeZone}</span>
            </div>
            <AnimatePresence mode="popLayout">
              <motion.div
                key={timeStr}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.15 }}
                className="mt-2 font-display text-6xl font-black tracking-tight tabular-nums md:text-7xl"
              >
                {timeStr}
              </motion.div>
            </AnimatePresence>
            <div className="mt-2 text-sm text-muted-foreground">{dateStr}</div>

            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {CITIES.map((c) => {
                const t = new Date().toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                  timeZone: c.tz,
                });
                return (
                  <div
                    key={c.name}
                    className="rounded-xl border border-border bg-card/60 p-3 backdrop-blur"
                  >
                    <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      {c.name}
                    </div>
                    <div className="font-display text-lg font-bold tabular-nums">{t}</div>
                  </div>
                );
              })}
            </div>

            <Stopwatch />
          </CardContent>
        </Card>

        {/* Reminders */}
        <Card className="flex flex-col">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>Reminders</CardTitle>
            <span className="text-xs text-muted-foreground">
              {reminders.filter((r) => r.enabled).length} active
            </span>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col">
            <ReminderForm onAdd={addReminder} />

            <ul className="mt-4 flex-1 space-y-2 overflow-y-auto">
              <AnimatePresence initial={false}>
                {reminders.map((r) => {
                  const Icon = ICONS[r.icon];
                  return (
                    <motion.li
                      key={r.id}
                      initial={{ opacity: 0, x: 8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -8 }}
                      className={cn(
                        "flex items-center gap-3 rounded-xl border border-border p-3 transition",
                        !r.enabled && "opacity-60",
                      )}
                    >
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl soma-gradient text-white">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{r.label}</div>
                        <div className="text-xs text-muted-foreground">
                          {r.time} · {r.repeat}
                        </div>
                      </div>
                      <button
                        onClick={() => toggle(r.id)}
                        className="rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"
                        aria-label={r.enabled ? "Mute" : "Unmute"}
                      >
                        {r.enabled ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
                      </button>
                      <button
                        onClick={() => remove(r.id)}
                        className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        aria-label="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </motion.li>
                  );
                })}
              </AnimatePresence>
              {reminders.length === 0 && (
                <li className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                  No reminders yet — add one above.
                </li>
              )}
            </ul>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

function Stopwatch() {
  const [ms, setMs] = useState(0);
  const [running, setRunning] = useState(false);
  const ref = useRef<number | null>(null);
  const startRef = useRef<number>(0);

  useEffect(() => {
    if (!running) return;
    startRef.current = Date.now() - ms;
    const tick = () => {
      setMs(Date.now() - startRef.current);
      ref.current = requestAnimationFrame(tick);
    };
    ref.current = requestAnimationFrame(tick);
    return () => {
      if (ref.current) cancelAnimationFrame(ref.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  const total = Math.floor(ms / 10);
  const cs = total % 100;
  const s = Math.floor(total / 100) % 60;
  const m = Math.floor(total / 6000);

  return (
    <div className="mt-6 rounded-xl border border-border bg-card/60 p-4 backdrop-blur">
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Stopwatch
        </div>
        <div className="font-display text-2xl font-bold tabular-nums">
          {String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}.{String(cs).padStart(2, "0")}
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <Button
          size="sm"
          onClick={() => setRunning((r) => !r)}
          className="soma-gradient soma-glow border-0 text-white"
        >
          {running ? "Pause" : "Start"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setRunning(false);
            setMs(0);
          }}
        >
          Reset
        </Button>
      </div>
    </div>
  );
}

function ReminderForm({ onAdd }: { onAdd: (r: Omit<Reminder, "id" | "enabled">) => void }) {
  const [label, setLabel] = useState("");
  const [time, setTime] = useState("08:00");
  const [icon, setIcon] = useState<Reminder["icon"]>("pill");
  const [repeat, setRepeat] = useState<Reminder["repeat"]>("daily");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!label.trim()) return;
        onAdd({ label: label.trim(), time, icon, repeat });
        setLabel("");
      }}
      className="mt-4 space-y-3 rounded-xl border border-border bg-secondary/30 p-3"
    >
      <div className="grid gap-2 sm:grid-cols-[1fr,110px]">
        <div>
          <Label className="text-xs">Label</Label>
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Take Metformin 500mg"
          />
        </div>
        <div>
          <Label className="text-xs">Time</Label>
          <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {(Object.keys(ICONS) as Reminder["icon"][]).map((k) => {
          const Ic = ICONS[k];
          return (
            <button
              type="button"
              key={k}
              onClick={() => setIcon(k)}
              className={cn(
                "grid h-9 w-9 place-items-center rounded-lg border transition",
                icon === k
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:text-foreground",
              )}
              aria-label={k}
            >
              <Ic className="h-4 w-4" />
            </button>
          );
        })}
        <Select value={repeat} onValueChange={(v) => setRepeat(v as Reminder["repeat"])}>
          <SelectTrigger className="ml-auto h-9 w-[130px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="daily">Daily</SelectItem>
            <SelectItem value="weekdays">Weekdays</SelectItem>
            <SelectItem value="once">Once</SelectItem>
          </SelectContent>
        </Select>
        <Button type="submit" size="sm" className="soma-gradient soma-glow border-0 text-white">
          <Plus className="mr-1 h-3.5 w-3.5" /> Add
        </Button>
      </div>
    </form>
  );
}
