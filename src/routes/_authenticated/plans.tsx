import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  Dumbbell,
  UtensilsCrossed,
  CheckCircle2,
  Circle,
  Salad,
  Trophy,
  Loader2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, EmptyState } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/plans")({
  head: () => ({
    meta: [{ title: "My Plans — SomaCare" }, { name: "robots", content: "noindex" }],
  }),
  component: PlansPage,
});

type WorkoutPlan = { id: string; title: string; goal: string; duration_days: number; start_date: string };
type MealPlan = WorkoutPlan;
type PlanDay = { day_number: number; exercises?: unknown[] | null; meals?: Record<string, string> | null };

function currentDayNumber(plan: { start_date: string; duration_days: number }): number {
  const start = new Date(`${plan.start_date}T00:00:00`);
  const diff = Math.floor((Date.now() - start.getTime()) / 86400000) + 1;
  return Math.min(Math.max(diff, 1), plan.duration_days);
}

function PlansPage() {
  const qc = useQueryClient();

  const workoutPlans = useQuery({
    queryKey: ["plans", "workout", "active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workout_plans")
        .select("id,title,goal,duration_days,start_date")
        .eq("status", "active")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as WorkoutPlan[];
    },
  });

  const mealPlans = useQuery({
    queryKey: ["plans", "meal", "active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meal_plans")
        .select("id,title,goal,duration_days,start_date")
        .eq("status", "active")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as MealPlan[];
    },
  });

  const completions = useQuery({
    queryKey: ["plans", "completions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plan_day_completions")
        .select("plan_id,day_number");
      if (error) throw error;
      return new Set((data ?? []).map((c) => `${c.plan_id}:${c.day_number}`));
    },
  });

  const planIds = [
    ...(workoutPlans.data ?? []).map((p) => p.id),
    ...(mealPlans.data ?? []).map((p) => p.id),
  ];

  const daysQuery = useQuery({
    queryKey: ["plan_days", planIds.join(",")],
    enabled: planIds.length > 0,
    queryFn: async () => {
      const [w, m] = await Promise.all([
        supabase.from("workout_plan_days").select("*").in("plan_id", planIds),
        supabase.from("meal_plan_days").select("*").in("plan_id", planIds),
      ]);
      if (w.error) throw w.error;
      if (m.error) throw m.error;
      return {
        workout: new Map<string, PlanDay[]>((w.data ?? []).length ? groupByDay(w.data) : []),
        meal: new Map<string, PlanDay[]>((m.data ?? []).length ? groupByDay(m.data) : []),
      };
    },
  });

  const markDone = useMutation({
    mutationFn: async (args: { planId: string; planType: "workout" | "meal"; dayNumber: number }) => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not authenticated");
      const { error } = await supabase.from("plan_day_completions").upsert({
        plan_id: args.planId,
        plan_type: args.planType,
        day_number: args.dayNumber,
        user_id: u.user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["plans"] });
      void qc.invalidateQueries({ queryKey: ["plan_days"] });
    },
  });

  const loading = workoutPlans.isLoading || mealPlans.isLoading;
  const hasPlans =
    (workoutPlans.data?.length ?? 0) > 0 || (mealPlans.data?.length ?? 0) > 0;

  return (
    <AppShell title="My Plans" subtitle="AI-generated workout & meal plans">
      <div className="grid gap-4 sm:gap-6">
        {loading ? (
          <>
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
          </>
        ) : !hasPlans ? (
          <section className="soma-card p-6 sm:p-8">
            <EmptyState
              icon={Trophy}
              title="No active plans yet"
              body="Ask Adwoa in the AI Assistant to create a workout or meal plan — then follow it here, day by day."
              action={
                <a href="/assistant">
                  <Button size="sm" className="soma-gradient soma-glow border-0 text-white">
                    Ask Adwoa
                  </Button>
                </a>
              }
            />
          </section>
        ) : (
          <>
            {(workoutPlans.data ?? []).map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                planType="workout"
                icon={Dumbbell}
                accent="text-orange-500"
                days={daysQuery.data?.workout.get(plan.id)}
                completed={completions.data}
                marking={markDone.isPending}
                onMarkDone={(day) =>
                  markDone.mutate({ planId: plan.id, planType: "workout", dayNumber: day })
                }
              />
            ))}
            {(mealPlans.data ?? []).map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                planType="meal"
                icon={UtensilsCrossed}
                accent="text-emerald-500"
                days={daysQuery.data?.meal.get(plan.id)}
                completed={completions.data}
                marking={markDone.isPending}
                onMarkDone={(day) =>
                  markDone.mutate({ planId: plan.id, planType: "meal", dayNumber: day })
                }
              />
            ))}
          </>
        )}
      </div>
    </AppShell>
  );
}

function groupByDay(rows: Array<Record<string, unknown>>): [string, PlanDay[]][] {
  const map = new Map<string, PlanDay[]>();
  for (const row of rows) {
    const key = row.plan_id as string;
    const list = map.get(key) ?? [];
    list.push(row as unknown as PlanDay);
    map.set(key, list);
  }
  return [...map.entries()];
}

function PlanCard({
  plan,
  planType,
  icon: Icon,
  accent,
  days,
  completed,
  marking,
  onMarkDone,
}: {
  plan: WorkoutPlan;
  planType: "workout" | "meal";
  icon: typeof Dumbbell;
  accent: string;
  days?: PlanDay[];
  completed?: Set<string>;
  marking: boolean;
  onMarkDone: (dayNumber: number) => void;
}) {
  const today = currentDayNumber(plan);
  const doneCount =
    [...(completed ?? [])].filter((k) => k.startsWith(`${plan.id}:`)).length;
  const doneToday = completed?.has(`${plan.id}:${today}`) ?? false;
  const todayPlan = days?.find((d) => d.day_number === today);

  return (
    <section className="soma-card p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-muted">
            <Icon className={cn("h-5 w-5", accent)} />
          </div>
          <div>
            <h2 className="font-display text-base font-semibold sm:text-lg">{plan.title}</h2>
            <p className="text-xs capitalize text-muted-foreground">
              Goal: {plan.goal} · started {format(new Date(`${plan.start_date}T00:00:00`), "MMM d")}
            </p>
          </div>
        </div>
        <div className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
          Day {today} of {plan.duration_days} · {doneCount} done
        </div>
      </div>

      {/* Today's plan */}
      <div className="mt-4 rounded-2xl border border-border/70 bg-muted/30 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            {planType === "meal" ? (
              <Salad className="h-4 w-4 text-emerald-500" />
            ) : (
              <Icon className={cn("h-4 w-4", accent)} />
            )}
            Today{planType === "meal" ? "'s meals" : "'s workout"}
          </div>
          <Button
            size="sm"
            variant={doneToday ? "outline" : "default"}
            disabled={doneToday || marking}
            onClick={() => onMarkDone(today)}
            className={cn(
              !doneToday && "soma-gradient soma-glow border-0 text-white",
              "gap-1.5",
            )}
          >
            {doneToday ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Done
              </>
            ) : marking ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Saving…
              </>
            ) : (
              <>
                <Circle className="h-4 w-4" /> Mark done
              </>
            )}
          </Button>
        </div>

        {!days ? (
          <Skeleton className="mt-3 h-16 w-full" />
        ) : planType === "workout" ? (
          <ul className="mt-3 space-y-1.5">
            {(((todayPlan?.exercises ?? []) as Array<{ name: string; sets: number; reps: string; notes?: string }>)).map(
              (ex, i) => (
                <li key={i} className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate">{ex.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {ex.sets} × {ex.reps}
                  </span>
                </li>
              ),
            )}
            {!todayPlan?.exercises?.length && (
              <li className="text-sm text-muted-foreground">Rest day or no exercises listed.</li>
            )}
          </ul>
        ) : (
          <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            {(["breakfast", "lunch", "dinner", "snacks"] as const).map((meal) =>
              todayPlan?.meals?.[meal] ? (
                <div key={meal} className="rounded-xl bg-background px-3 py-2">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {meal}
                  </div>
                  <div className="truncate">{todayPlan.meals[meal]}</div>
                </div>
              ) : null,
            )}
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full soma-gradient transition-all"
          style={{ width: `${Math.round((doneCount / plan.duration_days) * 100)}%` }}
        />
      </div>
    </section>
  );
}
