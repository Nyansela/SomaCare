import { useTranslation } from "react-i18next";
import i18n from "@/i18n";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Dumbbell, Plus, Clock, Flame, Loader2, Info, Activity } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, EmptyState } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { InfoBanner } from "@/components/ui/info-banner";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
} from "recharts";

export const Route = createFileRoute("/_authenticated/fitness")({
  head: () => ({ meta: [{ title: "Fitness — SomaCare" }, { name: "robots", content: "noindex" }] }),
  component: FitnessPage,
});

type FitnessLog = {
  id: string;
  user_id: string;
  workout_type: string | null;
  duration_minutes: number;
  intensity: string | null;
  logged_date: string;
  notes: string | null;
  created_at: string;
};

function FitnessPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const [gettingSuggestion, setGettingSuggestion] = useState(false);

  // Form state
  const [workoutType, setWorkoutType] = useState("");
  const [customWorkout, setCustomWorkout] = useState("");
  const [duration, setDuration] = useState("");
  const [intensity, setIntensity] = useState<string | undefined>();
  const [notes, setNotes] = useState("");
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));

  // User preferences
  const [wantsSuggestions, setWantsSuggestions] = useState(false);
  const [dailySuggestion, setDailySuggestion] = useState<string | null>(null);

  // Workout types and intensity options with translation
  const WORKOUT_TYPES = [
    { value: "walk", label: t("fitness.types.walk", "Walking") },
    { value: "run", label: t("fitness.types.run", "Running") },
    { value: "strength", label: t("fitness.types.strength", "Strength Training") },
    { value: "cardio", label: t("fitness.types.cardio", "Cardio") },
    { value: "yoga", label: t("fitness.types.yoga", "Yoga") },
    { value: "swimming", label: t("fitness.types.swimming", "Swimming") },
    { value: "cycling", label: t("fitness.types.cycling", "Cycling") },
    { value: "stretching", label: t("fitness.types.stretching", "Stretching") },
    { value: "other", label: t("fitness.types.other", "Other") },
  ];

  const INTENSITY_OPTIONS = [
    { value: "light", label: t("fitness.intensityLight", "Light") },
    { value: "moderate", label: t("fitness.intensityModerate", "Moderate") },
    { value: "intense", label: t("fitness.intensityIntense", "Intense") },
  ];

  // Fetch fitness logs
  const fitnessLogs = useQuery({
    queryKey: ["fitness", "logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fitness_logs")
        .select("*")
        .order("logged_date", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data as FitnessLog[]) || [];
    },
  });

  // Fetch user preferences for suggestions
  const userPrefs = useQuery({
    queryKey: ["fitness", "prefs"],
    queryFn: async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return { wants_suggestions: false };

      // Try to get from profiles table, default to false
      const { data, error } = await supabase
        .from("profiles")
        .select("preferences")
        .eq("id", session.user.id)
        .maybeSingle();

      if (error || !data) return { wants_suggestions: false };
      const prefs = data.preferences as Record<string, unknown> | null;
      return { wants_suggestions: prefs?.fitness_suggestions === true };
    },
  });

  // Sync wantsSuggestions from userPrefs.data when the query completes
  React.useEffect(() => {
    if (userPrefs.data) {
      setWantsSuggestions(userPrefs.data.wants_suggestions);
    }
  }, [userPrefs.data]);

  // Calculate this week's stats
  const today = new Date();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay());
  const weekStart = startOfWeek.toISOString().split("T")[0];

  const weekLogs = fitnessLogs.data?.filter((log) => log.logged_date >= weekStart) || [];
  const weekMinutes = weekLogs.reduce((sum, log) => sum + log.duration_minutes, 0);
  const weekWorkouts = weekLogs.length;

  // Get last 7 days for chart
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - i));
    return date.toISOString().split("T")[0];
  });

  const chartData = last7Days.map((date) => {
    const dayLogs = fitnessLogs.data?.filter((log) => log.logged_date === date) || [];
    const total = dayLogs.reduce((sum, log) => sum + log.duration_minutes, 0);
    return {
      date: format(new Date(date), "EEE"),
      fullDate: date,
      minutes: total,
    };
  });

  const logWorkoutMutation = useMutation({
    mutationFn: async (durationNum: number) => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const type = workoutType === "other" ? customWorkout : workoutType;

      const { error } = await supabase.from("fitness_logs").insert({
        user_id: session.user.id,
        workout_type: type || null,
        duration_minutes: durationNum,
        intensity: intensity || null,
        logged_date: selectedDate,
        notes: notes || null,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Workout logged!");
      qc.invalidateQueries({ queryKey: ["fitness"] });

      // Reset form
      setWorkoutType("");
      setCustomWorkout("");
      setDuration("");
      setIntensity(undefined);
      setNotes("");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to log workout");
    },
  });

  const logWorkout = () => {
    if (!workoutType || !duration || !selectedDate) {
      toast.error("Please fill in workout type and duration");
      return;
    }

    const durationNum = parseInt(duration, 10);
    if (!durationNum || durationNum <= 0) {
      toast.error("Please enter a valid duration");
      return;
    }

    logWorkoutMutation.mutate(durationNum);
  };

  const getSuggestion = async () => {
    setGettingSuggestion(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await fetch("/api/fitness-suggestion", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ language: i18n.language }),
      });

      if (!response.ok) {
        const err = await response.text();
        throw new Error(err || "Failed to get suggestion");
      }

      const result = await response.json();
      setDailySuggestion(result.suggestion);
      toast.success("Got workout suggestion!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to get suggestion");
    } finally {
      setGettingSuggestion(false);
    }
  };

  const toggleSuggestionsMutation = useMutation({
    mutationFn: async () => {
      const newValue = !wantsSuggestions;
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      // Get current preferences
      const { data: profile } = await supabase
        .from("profiles")
        .select("preferences")
        .eq("id", session.user.id)
        .maybeSingle();

      const currentPrefs = (profile?.preferences as Record<string, unknown> | null) || {};
      const newPrefs = { ...currentPrefs, fitness_suggestions: newValue };

      const { error } = await supabase
        .from("profiles")
        .update({ preferences: newPrefs })
        .eq("id", session.user.id);

      if (error) throw error;
      return newValue;
    },
    onSuccess: (newValue) => {
      setWantsSuggestions(newValue);
      qc.invalidateQueries({ queryKey: ["fitness", "prefs"] });
      toast.success(newValue ? "Workout suggestions enabled!" : "Workout suggestions disabled");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to update preference");
    },
  });

  const toggleSuggestions = () => toggleSuggestionsMutation.mutate();

  return (
    <AppShell
      title={t("fitness.title", "Fitness")}
      subtitle={t("fitness.subtitle", "Track your workouts and activity")}
      action={
        <Button
          onClick={getSuggestion}
          disabled={gettingSuggestion}
          className="soma-gradient soma-glow border-0 text-white"
        >
          {gettingSuggestion ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Info className="mr-2 h-4 w-4" />
          )}
          {gettingSuggestion
            ? t("fitness.getting", "Getting...")
            : t("fitness.getSuggestion", "Get Suggestion")}
        </Button>
      }
    >
      <div className="space-y-6">
        {/* Weekly Summary */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Clock className="h-4 w-4" /> {t("fitness.thisWeek", "This Week")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{weekMinutes} min</p>
              <p className="text-xs text-muted-foreground">
                {t("fitness.totalActivity", "total activity")}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Dumbbell className="h-4 w-4" /> {t("fitness.workouts", "Workouts")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{weekWorkouts}</p>
              <p className="text-xs text-muted-foreground">
                {t("fitness.thisWeekLabel", "this week")}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* AI Suggestion */}
        {dailySuggestion && (
          <Card className="border border-[var(--info)]/30 bg-[var(--info)]/10">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Activity className="h-4 w-4 text-[var(--info)]" />
                {t("fitness.suggestionTitle", "Today's Workout Suggestion")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-line">{dailySuggestion}</p>
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 text-xs text-muted-foreground"
                onClick={() => setDailySuggestion(null)}
              >
                {t("fitness.dismiss", "Dismiss")}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Log Workout Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              {t("fitness.logWorkout", "Log Workout")}
            </CardTitle>
            <CardDescription>
              {t("fitness.logWorkoutDesc", "Record a completed workout")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
              <div>
                <Label>{t("fitness.workoutType", "Workout Type")}</Label>
                <Select value={workoutType} onValueChange={setWorkoutType}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("fitness.selectType", "Select type")} />
                  </SelectTrigger>
                  <SelectContent>
                    {WORKOUT_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {workoutType === "other" && (
                <div>
                  <Label>{t("fitness.specify", "Specify workout")}</Label>
                  <Input
                    placeholder={t("fitness.placeholderSpecify", "e.g. Dancing")}
                    value={customWorkout}
                    onChange={(e) => setCustomWorkout(e.target.value)}
                  />
                </div>
              )}

              <div>
                <Label>{t("fitness.duration", "Duration (minutes)")}</Label>
                <Input
                  type="number"
                  placeholder={t("fitness.placeholderDuration", "e.g. 30")}
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                />
              </div>

              <div>
                <Label>{t("fitness.intensity", "Intensity")}</Label>
                <Select value={intensity} onValueChange={setIntensity}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("fitness.placeholderIntensity", "Optional")} />
                  </SelectTrigger>
                  <SelectContent>
                    {INTENSITY_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>{t("fitness.date", "Date")}</Label>
                <Input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  max={format(new Date(), "yyyy-MM-dd")}
                />
              </div>
            </div>

            <div className="mt-4">
              <Label>{t("fitness.notes", "Notes (optional)")}</Label>
              <Textarea
                placeholder={t("fitness.placeholderNotes", "How did it feel? Any observations?")}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="mt-1"
              />
            </div>

            <Button
              onClick={logWorkout}
              disabled={logWorkoutMutation.isPending}
              className="mt-4 soma-gradient soma-glow border-0 text-white"
            >
              {logWorkoutMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              {t("fitness.logButton", "Log Workout")}
            </Button>
          </CardContent>
        </Card>

        {/* Weekly Chart */}
        {chartData.length > 0 && chartData.some((d) => d.minutes > 0) && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">
                {t("fitness.weeklyActivity", "This Week's Activity")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "var(--card)",
                        border: "1px solid var(--border)",
                        borderRadius: "8px",
                      }}
                      formatter={(value: number) => [
                        `${value} min`,
                        t("fitness.minutes", "Minutes"),
                      ]}
                    />
                    <Bar
                      dataKey="minutes"
                      name={t("fitness.minutes", "Minutes")}
                      radius={[4, 4, 0, 0]}
                    >
                      {chartData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.minutes > 0 ? "var(--warning)" : "var(--border)"}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Recent Logs */}
        {fitnessLogs.isLoading ? (
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-32" />
            </CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-14 w-full rounded-lg" />
              <Skeleton className="h-14 w-full rounded-lg" />
              <Skeleton className="h-14 w-full rounded-lg" />
            </CardContent>
          </Card>
        ) : fitnessLogs.data && fitnessLogs.data.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">
                {t("fitness.recentWorkouts", "Recent Workouts")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <AnimatePresence initial={false}>
                  {fitnessLogs.data.slice(0, 10).map((log) => (
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      key={log.id}
                      className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <Dumbbell className="h-4 w-4 text-[var(--warning)]" />
                        <div>
                          <p className="font-medium">{log.workout_type || "Workout"}</p>
                          <p className="text-sm text-muted-foreground">
                            {log.duration_minutes} min • {log.intensity || "N/A"}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm">{format(new Date(log.logged_date), "MMM d")}</p>
                        {log.notes && (
                          <p className="text-xs text-muted-foreground line-clamp-1">{log.notes}</p>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </CardContent>
          </Card>
        ) : (
          <EmptyState
            icon={Dumbbell}
            title={t("fitness.noWorkouts", "No workouts logged yet")}
            body={t(
              "fitness.noWorkoutsBody",
              "Start tracking your fitness activities to see your progress.",
            )}
          />
        )}
      </div>
    </AppShell>
  );
}
