import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Moon, Sun, Loader2, Star, Clock, TrendingUp, AlertCircle, Info } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, EmptyState } from "@/components/app-shell";
import { InfoBanner } from "@/components/ui/info-banner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export const Route = createFileRoute("/_authenticated/sleep")({
  head: () => ({ meta: [{ title: "Sleep — SomaCare" }, { name: "robots", content: "noindex" }] }),
  component: SleepPage,
});

type SleepLog = {
  id: string;
  user_id: string;
  bedtime: string;
  wake_time: string;
  quality_rating: number | null;
  notes: string | null;
  logged_date: string;
  created_at: string;
};

type SleepRecommendations = {
  recommendedBedtime: string;
  recommendedWakeTime: string;
  sleepDuration: string;
  tips: { title: string; description: string }[];
  notes: string;
};

type SleepStats = {
  avgHours: number;
  avgBedtime: string;
  avgWakeTime: string;
  consistencyScore: number;
  avgQuality: number | null;
};

function SleepPage() {
  const qc = useQueryClient();

  const [gettingRecommendations, setGettingRecommendations] = useState(false);
  
  // Form state
  const [bedtime, setBedtime] = useState("");
  const [wakeTime, setWakeTime] = useState("");
  const [qualityRating, setQualityRating] = useState(3);
  const [notes, setNotes] = useState("");
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));

  // Fetch sleep logs
  const sleepLogs = useQuery({
    queryKey: ["sleep", "logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sleep_logs")
        .select("*")
        .order("logged_date", { ascending: false })
        .limit(30);
      if (error) throw error;
      return data as SleepLog[] || [];
    },
  });

  // Fetch AI recommendations
  const recommendations = useQuery({
    queryKey: ["sleep", "recommendations"],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await fetch("/api/sleep", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        const err = await response.text();
        throw new Error(err || "Failed to get recommendations");
      }

      const result = await response.json();
      return result as { recommendations: SleepRecommendations; sleepStats: SleepStats };
    },
    enabled: false, // Only fetch on demand
  });

  const logSleepMutation = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      // Combine date with time
      const bedtimeDT = new Date(`${selectedDate}T${bedtime}:00`);
      const wakeTimeDT = new Date(`${selectedDate}T${wakeTime}:00`);

      // If wake time is before bedtime, assume it's the next day
      if (wakeTimeDT <= bedtimeDT) {
        wakeTimeDT.setDate(wakeTimeDT.getDate() + 1);
      }

      const { error } = await supabase.from("sleep_logs").insert({
        user_id: session.user.id,
        bedtime: bedtimeDT.toISOString(),
        wake_time: wakeTimeDT.toISOString(),
        quality_rating: qualityRating,
        notes: notes || null,
        logged_date: selectedDate,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Sleep logged successfully!");
      qc.invalidateQueries({ queryKey: ["sleep"] });

      // Reset form
      setBedtime("");
      setWakeTime("");
      setQualityRating(3);
      setNotes("");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to log sleep");
    },
  });

  const logSleep = () => {
    if (!bedtime || !wakeTime || !selectedDate) {
      toast.error("Please fill in bedtime, wake time, and date");
      return;
    }
    logSleepMutation.mutate();
  };

  const getRecommendations = async () => {
    setGettingRecommendations(true);
    try {
      qc.invalidateQueries({ queryKey: ["sleep", "recommendations"] });
      await recommendations.refetch();
      toast.success("Sleep recommendations generated!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to get recommendations");
    } finally {
      setGettingRecommendations(false);
    }
  };

  // Prepare chart data
  const chartData = sleepLogs.data
    ?.slice(0, 14)
    .reverse()
    .map((log) => {
      const bedtime = new Date(log.bedtime);
      const wakeTime = new Date(log.wake_time);
      let hours = (wakeTime.getTime() - bedtime.getTime()) / (1000 * 60 * 60);
      if (hours < 0) hours += 24;
      return {
        date: format(new Date(log.logged_date), "MMM d"),
        hours: Math.round(hours * 10) / 10,
        quality: log.quality_rating,
      };
    }) || [];

  const avgHours = sleepLogs.data && sleepLogs.data.length > 0
    ? sleepLogs.data.reduce((sum, log) => {
        const bedtime = new Date(log.bedtime);
        const wakeTime = new Date(log.wake_time);
        let hours = (wakeTime.getTime() - bedtime.getTime()) / (1000 * 60 * 60);
        if (hours < 0) hours += 24;
        return sum + hours;
      }, 0) / sleepLogs.data.length
    : 0;

  const avgQuality = sleepLogs.data && sleepLogs.data.filter(l => l.quality_rating).length > 0
    ? sleepLogs.data.filter(l => l.quality_rating).reduce((sum, l) => sum + (l.quality_rating || 0), 0) / sleepLogs.data.filter(l => l.quality_rating).length
    : null;

  return (
    <AppShell
      title="Sleep"
      subtitle="Track and optimize your sleep"
      action={
        <Button 
          onClick={getRecommendations} 
          disabled={gettingRecommendations || sleepLogs.data?.length === 0} 
          className="soma-gradient soma-glow border-0 text-white"
        >
          {gettingRecommendations ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Info className="mr-2 h-4 w-4" />}
          {gettingRecommendations ? "Analyzing..." : "Get AI Recommendations"}
        </Button>
      }
    >
      <div className="space-y-6">
        {/* Log Sleep Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Moon className="h-5 w-5" />
              Log Sleep
            </CardTitle>
            <CardDescription>Record your sleep for today or a past date</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
              <div>
                <Label htmlFor="date">Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  max={format(new Date(), "yyyy-MM-dd")}
                />
              </div>
              <div>
                <Label htmlFor="bedtime">Bedtime</Label>
                <Input
                  id="bedtime"
                  type="time"
                  value={bedtime}
                  onChange={(e) => setBedtime(e.target.value)}
                  placeholder="e.g. 22:30"
                />
              </div>
              <div>
                <Label htmlFor="wakeTime">Wake Time</Label>
                <Input
                  id="wakeTime"
                  type="time"
                  value={wakeTime}
                  onChange={(e) => setWakeTime(e.target.value)}
                  placeholder="e.g. 06:30"
                />
              </div>
              <div>
                <Label>Quality Rating</Label>
                <div className="flex items-center gap-1 mt-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setQualityRating(star)}
                      className="p-1 hover:scale-110 transition-transform"
                    >
                      <Star
                        className={`h-5 w-5 ${
                          star <= qualityRating ? "fill-[var(--warning)] text-[var(--warning)]" : "text-muted-foreground"
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-end">
                <Button onClick={logSleep} disabled={logSleepMutation.isPending} className="w-full soma-gradient soma-glow border-0 text-white">
                  {logSleepMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Moon className="mr-2 h-4 w-4" />}
                  Log Sleep
                </Button>
              </div>
            </div>
            <div className="mt-4">
              <Label htmlFor="notes">Notes (optional)</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="How did you sleep? Any dreams, disruptions?"
                className="mt-1"
              />
            </div>
          </CardContent>
        </Card>

        {/* Stats Summary */}
        {sleepLogs.data && sleepLogs.data.length > 0 && (
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Clock className="h-4 w-4" /> Average Sleep
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{avgHours.toFixed(1)} hours</p>
                <p className="text-xs text-muted-foreground">per night</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Star className="h-4 w-4" /> Average Quality
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{avgQuality ? avgQuality.toFixed(1) : "N/A"}</p>
                <p className="text-xs text-muted-foreground">out of 5</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <TrendingUp className="h-4 w-4" /> Entries
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{sleepLogs.data.length}</p>
                <p className="text-xs text-muted-foreground">total logged</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* AI Recommendations */}
        {recommendations.data && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Info className="h-5 w-5 text-primary" />
                Personalized Sleep Recommendations
              </CardTitle>
              <CardDescription>Based on your recent sleep patterns and health context</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3 mb-6">
                <div className="bg-muted/50 rounded-lg p-4">
                  <p className="text-sm text-muted-foreground mb-1">Recommended Bedtime</p>
                  <p className="text-2xl font-bold">{recommendations.data.recommendations.recommendedBedtime}</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-4">
                  <p className="text-sm text-muted-foreground mb-1">Recommended Wake Time</p>
                  <p className="text-2xl font-bold">{recommendations.data.recommendations.recommendedWakeTime}</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-4">
                  <p className="text-sm text-muted-foreground mb-1">Target Duration</p>
                  <p className="text-2xl font-bold">{recommendations.data.recommendations.sleepDuration}</p>
                </div>
              </div>
              
              {recommendations.data.recommendations.tips && recommendations.data.recommendations.tips.length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-medium">Tips for Better Sleep</h4>
                  {recommendations.data.recommendations.tips.map((tip, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                      <AlertCircle className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                      <div>
                        <p className="font-medium text-sm">{tip.title}</p>
                        <p className="text-sm text-muted-foreground">{tip.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {recommendations.data.recommendations.notes && (
                <div className="mt-4">
                  <InfoBanner tone="accent">{recommendations.data.recommendations.notes}</InfoBanner>
                </div>
              )}

              <div className="mt-4 pt-4 border-t">
                <p className="text-xs text-muted-foreground">
                  <strong>Your Sleep Stats:</strong> Average {recommendations.data.sleepStats.avgHours.toFixed(1)} hrs/night, 
                  Consistency: {recommendations.data.sleepStats.consistencyScore}/10
                  {recommendations.data.sleepStats.avgQuality && `, Avg Quality: ${recommendations.data.sleepStats.avgQuality.toFixed(1)}/5`}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Trend Chart */}
        {chartData.length > 1 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Sleep Trend (Last 14 Days)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis domain={[0, 12]} tick={{ fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "var(--card)",
                        border: "1px solid var(--border)",
                        borderRadius: "8px",
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="hours"
                      stroke="var(--primary)"
                      strokeWidth={2}
                      dot={{ fill: "var(--primary)" }}
                      name="Hours"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Recent Logs */}
        {sleepLogs.isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : sleepLogs.data && sleepLogs.data.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Recent Sleep Logs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <AnimatePresence initial={false}>
                {sleepLogs.data.slice(0, 10).map((log) => {
                  const bedtime = new Date(log.bedtime);
                  const wakeTime = new Date(log.wake_time);
                  let hours = (wakeTime.getTime() - bedtime.getTime()) / (1000 * 60 * 60);
                  if (hours < 0) hours += 24;
                  
                  return (
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      key={log.id}
                      className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
                      <div>
                        <p className="font-medium">{format(new Date(log.logged_date), "EEEE, MMM d")}</p>
                        <p className="text-sm text-muted-foreground">
                          {format(bedtime, "h:mm a")} → {format(wakeTime, "h:mm a")}
                          {" "}({hours.toFixed(1)} hrs)
                        </p>
                        {log.notes && <p className="text-xs text-muted-foreground mt-1">{log.notes}</p>}
                      </div>
                      {log.quality_rating && (
                        <div className="flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                              key={star}
                              className={`h-3 w-3 ${
                                star <= log.quality_rating! ? "fill-[var(--warning)] text-[var(--warning)]" : "text-muted"
                              }`}
                            />
                          ))}
                        </div>
                      )}
                    </motion.div>
                  );
                })}
                </AnimatePresence>
              </div>
            </CardContent>
          </Card>
        ) : (
          <EmptyState
            icon={Moon}
            title="No sleep logs yet"
            body="Start tracking your sleep to see trends and get AI-powered recommendations."
          />
        )}
      </div>
    </AppShell>
  );
}
