import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Droplets, Plus, TrendingUp, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, EmptyState } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
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
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/_authenticated/hydration")({
  head: () => ({
    meta: [{ title: "Hydration — SomaCare" }, { name: "robots", content: "noindex" }],
  }),
  component: HydrationPage,
});

type HydrationLog = {
  id: string;
  user_id: string;
  amount_ml: number;
  logged_at: string;
  created_at: string;
};

// Default quick amounts in ml
const QUICK_AMOUNTS = [150, 250, 350, 500, 750];

function HydrationPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [customAmount, setCustomAmount] = useState("");
  const [customGoal] = useState<number | null>(null);
  const [loggingId, setLoggingId] = useState<string | null>(null);
  const customAmountRef = useRef<HTMLInputElement>(null);

  // Fetch user's body weight from health vault for goal calculation
  const healthVault = useQuery({
    queryKey: ["health-vault"],
    queryFn: async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return null;

      const { data, error } = await supabase
        .from("health_vault")
        .select("body_weight_kg")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });

  // Fetch hydration logs
  const hydrationLogs = useQuery({
    queryKey: ["hydration", "logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hydration_logs")
        .select("*")
        .order("logged_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data as HydrationLog[]) || [];
    },
  });

  // Calculate today's total
  const today = new Date().toISOString().split("T")[0];
  const todayTotal =
    hydrationLogs.data
      ?.filter((log) => log.logged_at.split("T")[0] === today)
      .reduce((sum, log) => sum + log.amount_ml, 0) || 0;

  // Calculate personalized goal (35ml per kg body weight)
  const calculatedGoal = healthVault.data?.body_weight_kg
    ? Math.round(healthVault.data.body_weight_kg * 35)
    : 2500; // Default fallback

  const dailyGoal = customGoal ?? calculatedGoal;
  const progressPercent = Math.min((todayTotal / dailyGoal) * 100, 100);

  // Get last 7 days data for chart
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - i));
    return date.toISOString().split("T")[0];
  });

  const chartData = last7Days.map((date) => {
    const dayLogs = hydrationLogs.data?.filter((log) => log.logged_at.split("T")[0] === date) || [];
    const total = dayLogs.reduce((sum, log) => sum + log.amount_ml, 0);
    return {
      date: format(new Date(date), "EEE"),
      fullDate: date,
      ml: total,
      goal: dailyGoal,
    };
  });

  const logWaterMutation = useMutation({
    mutationFn: async (amount: number) => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const { error } = await supabase.from("hydration_logs").insert({
        user_id: session.user.id,
        amount_ml: amount,
        logged_at: new Date().toISOString(),
      });

      if (error) throw error;
      return amount;
    },
    onMutate: (amount) => setLoggingId(amount.toString()),
    onSuccess: (amount) => {
      toast.success(t("hydration.toastLogged", "Logged {{amount}}ml!", { amount }));
      qc.invalidateQueries({ queryKey: ["hydration"] });
    },
    onError: (err) => {
      toast.error(
        err instanceof Error ? err.message : t("hydration.toastLogFailed", "Failed to log"),
      );
    },
    onSettled: () => setLoggingId(null),
  });

  const logWater = (amount: number) => logWaterMutation.mutate(amount);

  const handleCustomLog = () => {
    const amount = parseInt(customAmount, 10);
    if (!amount || amount <= 0) {
      toast.error(t("hydration.toastInvalidAmount", "Please enter a valid amount"));
      return;
    }
    logWater(amount);
    setCustomAmount("");
  };

  return (
    <AppShell
      title={t("hydration.title", "Hydration")}
      subtitle={t("hydration.subtitle", "Track your daily water intake")}
      action={
        <Button
          className="soma-gradient soma-glow border-0 text-white"
          onClick={() => {
            customAmountRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
            customAmountRef.current?.focus({ preventScroll: true });
          }}
        >
          <Droplets className="mr-2 h-4 w-4" />
          {t("hydration.logWater", "Log water")}
        </Button>
      }
    >
      <div className="space-y-6">
        {/* Today's Progress */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Droplets className="h-5 w-5 text-[var(--info)]" />
              {t("hydration.todaysIntake", "Today's Intake")}
            </CardTitle>
            <CardDescription>
              {t("hydration.goal", "Goal")}: {dailyGoal}ml{" "}
              {customGoal
                ? t("hydration.goalCustom", "(custom)")
                : healthVault.data?.body_weight_kg
                  ? `(${healthVault.data.body_weight_kg}kg × 35ml/kg)`
                  : t("hydration.goalDefault", "(default)")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Progress bar */}
              <div className="relative h-8 bg-muted rounded-full overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 bg-[var(--info)] transition-all duration-500"
                  style={{ width: `${progressPercent}%` }}
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-sm font-bold text-foreground">
                    {todayTotal}ml / {dailyGoal}ml ({Math.round(progressPercent)}%)
                  </span>
                </div>
              </div>

              {/* Quick log buttons */}
              <div className="flex flex-wrap gap-2">
                {QUICK_AMOUNTS.map((amount) => (
                  <Button
                    key={amount}
                    variant="outline"
                    onClick={() => logWater(amount)}
                    disabled={loggingId === amount.toString()}
                  >
                    {loggingId === amount.toString() ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-1" />
                    ) : (
                      <Droplets className="h-4 w-4 mr-1 text-[var(--info)]" />
                    )}
                    {amount}ml
                  </Button>
                ))}
              </div>

              {/* Custom amount input */}
              <div className="flex gap-2">
                <div className="flex-1">
                  <Label htmlFor="custom-amount">
                    {t("hydration.customAmount", "Custom amount (ml)")}
                  </Label>
                  <Input
                    ref={customAmountRef}
                    id="custom-amount"
                    type="number"
                    placeholder={t("hydration.customAmountPlaceholder", "e.g. 200")}
                    value={customAmount}
                    onChange={(e) => setCustomAmount(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleCustomLog()}
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    onClick={handleCustomLog}
                    disabled={loggingId !== null}
                    className="soma-gradient soma-glow border-0 text-white"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    {t("hydration.add", "Add")}
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 7-Day Trend */}
        {chartData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                {t("hydration.last7Days", "Last 7 Days")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
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
                      formatter={(value: number) => [`${value}ml`, t("hydration.intake", "Intake")]}
                    />
                    <Bar dataKey="ml" name={t("hydration.intake", "Intake")} radius={[4, 4, 0, 0]}>
                      {chartData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.ml >= entry.goal ? "var(--success)" : "var(--info)"}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-center gap-4 mt-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-[var(--info)] rounded" /> Below goal
                </span>
                <span className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-[var(--success)] rounded" /> Goal met
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Recent Logs */}
        {hydrationLogs.isLoading ? (
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-32" />
            </CardHeader>
            <CardContent className="space-y-2">
              <Skeleton className="h-12 w-full rounded-lg" />
              <Skeleton className="h-12 w-full rounded-lg" />
              <Skeleton className="h-12 w-full rounded-lg" />
            </CardContent>
          </Card>
        ) : hydrationLogs.data && hydrationLogs.data.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Recent Logs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <AnimatePresence initial={false}>
                  {hydrationLogs.data.slice(0, 10).map((log) => (
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      key={log.id}
                      className="flex items-center justify-between rounded-lg bg-muted/50 p-3"
                    >
                      <div className="flex items-center gap-2">
                        <Droplets className="h-4 w-4 text-[var(--info)]" />
                        <span className="font-medium">{log.amount_ml}ml</span>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {format(new Date(log.logged_at), "MMM d, h:mm a")}
                      </span>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </CardContent>
          </Card>
        ) : (
          <EmptyState
            icon={Droplets}
            title="No hydration logs yet"
            body="Start tracking your water intake to stay hydrated and healthy."
          />
        )}
      </div>
    </AppShell>
  );
}
