import { useTranslation } from "react-i18next";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Utensils, Loader2, Clock, RefreshCw, Apple, Coffee, Moon, Cookie } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, EmptyState } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { InfoBanner } from "@/components/ui/info-banner";

export const Route = createFileRoute("/_authenticated/nutrition")({
  head: () => ({
    meta: [{ title: "Nutrition — SomaCare" }, { name: "robots", content: "noindex" }],
  }),
  component: Nutrition,
});

type NutritionPlan = {
  id: string;
  generated_at: string;
  plan_data: {
    breakfast?: { time: string; description: string; calories: number };
    lunch?: { time: string; description: string; calories: number };
    dinner?: { time: string; description: string; calories: number };
    snacks?: { time: string; description: string; calories: number }[];
    medication_timing?: { medication: string; timing: string; reason: string }[];
    notes?: string;
  };
  medication_reminders: { medication: string; timing: string; reason: string }[];
};

function Nutrition() {
  const { t } = useTranslation();
  const qc = useQueryClient();

  // Fetch current (latest) nutrition plan
  const currentPlan = useQuery({
    queryKey: ["nutrition", "current"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("nutrition_plans")
        .select("*")
        .order("generated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as NutritionPlan | null;
    },
  });

  // Fetch plan history
  const planHistory = useQuery({
    queryKey: ["nutrition", "history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("nutrition_plans")
        .select("*")
        .order("generated_at", { ascending: false })
        .limit(7);
      if (error) throw error;
      return (data as unknown as NutritionPlan[]) || [];
    },
  });

  const generatePlanMutation = useMutation({
    mutationFn: async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await fetch("/api/nutrition", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        const err = await response.text();
        throw new Error(err || "Failed to generate plan");
      }

      await response.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["nutrition"] });
      toast.success("Nutrition plan generated!");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to generate plan");
    },
  });

  const generatePlan = () => generatePlanMutation.mutate();
  const generating = generatePlanMutation.isPending;

  const getMealIcon = (mealName: string) => {
    if (mealName.toLowerCase().includes("breakfast")) return <Coffee className="h-5 w-5" />;
    if (mealName.toLowerCase().includes("lunch")) return <Apple className="h-5 w-5" />;
    if (mealName.toLowerCase().includes("dinner")) return <Moon className="h-5 w-5" />;
    return <Cookie className="h-5 w-5" />;
  };

  const totalCalories = currentPlan.data?.plan_data
    ? (currentPlan.data.plan_data.breakfast?.calories || 0) +
      (currentPlan.data.plan_data.lunch?.calories || 0) +
      (currentPlan.data.plan_data.dinner?.calories || 0) +
      (currentPlan.data.plan_data.snacks?.reduce((sum, s) => sum + (s.calories || 0), 0) || 0)
    : 0;

  return (
    <AppShell
      title={t("nutrition.title", "Nutrition")}
      subtitle={t("nutrition.subtitle", "Your personalized meal plan")}
      action={
        <Button
          onClick={generatePlan}
          disabled={generating}
          className="soma-gradient soma-glow border-0 text-white"
        >
          {generating ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          {generating
            ? t("nutrition.generating", "Generating...")
            : t("nutrition.regenerate", "Regenerate Plan")}
        </Button>
      }
    >
      <div className="space-y-6">
        {/* Disclaimer */}
        <InfoBanner tone="warning">
          <strong>{t("nutrition.medicationTiming", "Medication Timing")}:</strong>{" "}
          {t(
            "nutrition.disclaimer",
            "The timing suggestions below are general guidelines only. Always follow your pharmacist or doctor's specific instructions for taking medications.",
          )}
        </InfoBanner>

        {!currentPlan.data && !currentPlan.isLoading ? (
          <EmptyState
            icon={Utensils}
            title={t("nutrition.noPlan", "No nutrition plan yet")}
            body={t(
              "nutrition.noPlanBody",
              "Generate a personalized meal plan based on your health profile and goals.",
            )}
            action={
              <Button
                onClick={generatePlan}
                disabled={generating}
                className="soma-gradient soma-glow border-0 text-white"
              >
                {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {t("nutrition.generate", "Generate My Plan")}
              </Button>
            }
          />
        ) : currentPlan.isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : currentPlan.data ? (
          <>
            {/* Current Plan */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {/* Breakfast */}
              {currentPlan.data.plan_data.breakfast && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Coffee className="h-4 w-4" /> {t("nutrition.breakfast", "Breakfast")}
                    </CardTitle>
                    <CardDescription>{currentPlan.data.plan_data.breakfast.time}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="font-medium">
                      {currentPlan.data.plan_data.breakfast.description}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {currentPlan.data.plan_data.breakfast.calories}{" "}
                      {t("nutrition.calories", "cal")}
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Lunch */}
              {currentPlan.data.plan_data.lunch && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Apple className="h-4 w-4" /> {t("nutrition.lunch", "Lunch")}
                    </CardTitle>
                    <CardDescription>{currentPlan.data.plan_data.lunch.time}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="font-medium">{currentPlan.data.plan_data.lunch.description}</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {currentPlan.data.plan_data.lunch.calories} {t("nutrition.calories", "cal")}
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Dinner */}
              {currentPlan.data.plan_data.dinner && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Moon className="h-4 w-4" /> {t("nutrition.dinner", "Dinner")}
                    </CardTitle>
                    <CardDescription>{currentPlan.data.plan_data.dinner.time}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="font-medium">{currentPlan.data.plan_data.dinner.description}</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {currentPlan.data.plan_data.dinner.calories} {t("nutrition.calories", "cal")}
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Total & Snacks */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Cookie className="h-4 w-4" /> {t("nutrition.dailyTotal", "Daily Total")}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{totalCalories}</p>
                  <p className="text-sm text-muted-foreground">{t("nutrition.calories", "cal")}</p>
                  {currentPlan.data.plan_data.snacks &&
                    currentPlan.data.plan_data.snacks.length > 0 && (
                      <div className="mt-3 pt-3 border-t">
                        <p className="text-xs font-medium mb-1">
                          {t("nutrition.snacks", "Snacks:")}
                        </p>
                        {currentPlan.data.plan_data.snacks.map((s, i) => (
                          <p key={i} className="text-xs text-muted-foreground">
                            {s.time}: {s.description}
                          </p>
                        ))}
                      </div>
                    )}
                </CardContent>
              </Card>
            </div>

            {/* Medication Timing */}
            {currentPlan.data.plan_data.medication_timing &&
              currentPlan.data.plan_data.medication_timing.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="h-5 w-5" />
                      {t("nutrition.medicationTiming", "Medication Timing")}
                    </CardTitle>
                    <CardDescription>
                      {t(
                        "nutrition.medicationDisclaimer",
                        "General guidance - follow your doctor's instructions",
                      )}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {currentPlan.data.plan_data.medication_timing.map((med, i) => (
                        <div key={i} className="flex items-start gap-3 rounded-lg bg-muted/50 p-3">
                          <Clock className="h-4 w-4 mt-0.5 text-primary" />
                          <div>
                            <p className="font-medium">{med.medication}</p>
                            <p className="text-sm text-muted-foreground">{med.timing}</p>
                            {med.reason && (
                              <p className="text-xs text-muted-foreground mt-1">{med.reason}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

            {/* Notes */}
            {currentPlan.data.plan_data.notes && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">{t("nutrition.notes", "Notes")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">{currentPlan.data.plan_data.notes}</p>
                </CardContent>
              </Card>
            )}

            {/* History */}
            {planHistory.data && planHistory.data.length > 1 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">
                    {t("nutrition.previousPlans", "Previous Plans")}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {planHistory.data.slice(1, 6).map((plan) => {
                      const date = new Date(plan.generated_at);
                      const dateString = `${format(date, "MMM d, yyyy")} ${t("nutrition.at", "at")} ${format(date, "h:mm a")}`;
                      return (
                        <div
                          key={plan.id}
                          className="flex items-center justify-between rounded-lg bg-muted/50 p-3 text-sm"
                        >
                          <span className="text-muted-foreground">{dateString}</span>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
