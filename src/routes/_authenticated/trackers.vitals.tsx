import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Activity, Plus, AlertTriangle, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, EmptyState } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { detectVitalAbnormalities, getVitalLabel, getVitalStatusColor, type VitalAbnormality } from "@/lib/vital-abnormalities";
import { StatusBadge } from "@/components/ui/status-badge";
import { InfoBanner } from "@/components/ui/info-banner";
import { useTranslation } from "react-i18next";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const KINDS = [
  { key: "bp_sys", labelKey: "vitals.bloodPressureSystolic", unit: "mmHg", range: "90-140" },
  { key: "bp_dia", labelKey: "vitals.bloodPressureDiastolic", unit: "mmHg", range: "60-90" },
  { key: "heart_rate", labelKey: "vitals.heartRate", unit: "bpm", range: "60-100" },
  { key: "spo2", labelKey: "vitals.bloodOxygen", unit: "%", range: "95-100" },
  { key: "glucose", labelKey: "vitals.bloodGlucose", unit: "mg/dL", range: "70-126" },
  { key: "weight", labelKey: "vitals.weight", unit: "kg", range: "varies" },
  { key: "temperature", labelKey: "vitals.temperature", unit: "°C", range: "36.1-37.2" },
];

export const Route = createFileRoute("/_authenticated/trackers/vitals")({
  head: () => ({ meta: [{ title: "Vitals — SomaCare" }, { name: "robots", content: "noindex" }] }),
  component: Vitals,
});

type VitalData = {
  id: string;
  kind: string;
  value: number;
  unit: string;
  taken_at: string;
  notes: string | null;
};

function Vitals() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selectedKind, setSelectedKind] = useState("heart_rate");
  const [form, setForm] = useState({ kind: "heart_rate", value: "", unit: "bpm" });
  const { t } = useTranslation();

  // Fetch vitals
  const list = useQuery({
    queryKey: ["vitals", "all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vitals")
        .select("*")
        .order("taken_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data as VitalData[];
    },
  });

  // Detect abnormalities
  const abnormalities = list.data ? detectVitalAbnormalities(
    list.data.map(v => ({ kind: v.kind, value: v.value, unit: v.unit, taken_at: v.taken_at }))
  ) : [];

  // Get chart data for selected kind
  const chartData = list.data
    ?.filter(v => v.kind === selectedKind)
    .slice(0, 20)
    .reverse()
    .map(v => ({
      date: format(new Date(v.taken_at), "MM/dd HH:mm"),
      value: v.value,
    })) || [];

  // Get latest reading for each kind
  const latestByKind = new Map<string, VitalData>();
  list.data?.forEach(v => {
    if (!latestByKind.has(v.kind)) {
      latestByKind.set(v.kind, v);
    }
  });

  const create = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const { error } = await supabase.from("vitals").insert({
        user_id: u.user.id,
        kind: form.kind,
        value: Number(form.value),
        unit: form.unit,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vitals"] });
      setOpen(false);
      setForm({ kind: "heart_rate", value: "", unit: "bpm" });
      toast.success(t("vitals.readingLogged", "Reading logged"));
    },
    onError: (e) => toast.error(e.message),
  });

  const handleKindChange = (kind: string) => {
    setSelectedKind(kind);
    const k = KINDS.find(x => x.key === kind);
    setForm(prev => ({ ...prev, kind, unit: k?.unit || "" }));
  };

  const getTrend = (kind: string) => {
    const data = list.data?.filter(v => v.kind === kind).slice(0, 10) || [];
    if (data.length < 2) return "stable";
    const recent = data[0]?.value || 0;
    const older = data[data.length - 1]?.value || 0;
    if (recent > older * 1.05) return "up";
    if (recent < older * 0.95) return "down";
    return "stable";
  };

  const getTrendIcon = (trend: string) => {
    if (trend === "up") return <TrendingUp className="h-4 w-4 text-destructive" />;
    if (trend === "down") return <TrendingDown className="h-4 w-4 text-[var(--info)]" />;
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  return (
    <AppShell
      title={t("vitals.title", "Vitals")}
      subtitle={t("vitals.subtitle", "Log and track your readings")}
      action={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="soma-gradient soma-glow border-0 text-white"><Plus className="mr-2 h-4 w-4" /> {t("vitals.logReading", "Log reading")}</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{t("vitals.logVital", "Log a vital")}</DialogTitle></DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); create.mutate(); }} className="space-y-4">
              <div>
                <Label>{t("vitals.kind", "Kind")}</Label>
                <Select value={form.kind} onValueChange={handleKindChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {KINDS.map((k) => <SelectItem key={k.key} value={k.key}>{t(k.labelKey)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2"><Label>{t("vitals.value", "Value")}</Label><Input type="number" step="any" required value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} /></div>
                <div><Label>{t("vitals.unit", "Unit")}</Label><Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} /></div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={create.isPending} className="soma-gradient soma-glow border-0 text-white">
                  {create.isPending ? t("vitals.saving", "Saving...") : t("vitals.save", "Save")}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      }
    >
      <div className="space-y-6">
        {/* Abnormality Warnings */}
        {abnormalities.length > 0 && (
          <InfoBanner tone="danger">
            <div className="font-semibold text-sm mb-2">{t("vitals.healthAlerts", "Health Alerts")}</div>
            <div className="space-y-1 text-sm">
              {abnormalities.map((ab, i) => (
                <div key={i} className="flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                  <span>{ab.message}</span>
                </div>
              ))}
            </div>
          </InfoBanner>
        )}

        <Tabs defaultValue="list" className="space-y-4">
          <TabsList>
            <TabsTrigger value="list">{t("vitals.list", "List")}</TabsTrigger>
            <TabsTrigger value="trends">{t("vitals.trends", "Trends")}</TabsTrigger>
          </TabsList>

          <TabsContent value="list">
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.15 }}
              className="space-y-4"
            >
            {/* Quick stats cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {KINDS.filter(k => k.key !== "weight").map(k => {
                const latest = latestByKind.get(k.key);
                const abnormality = abnormalities.find(a => a.kind === k.key);
                return (
                  <Card key={k.key} className={abnormality ? "border border-[var(--destructive)]/30" : ""}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs text-muted-foreground">{k.label}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between">
                        <div className="text-2xl font-bold">
                          {latest ? (
                            <>
                              {latest.value}
                              <span className="text-xs font-normal text-muted-foreground ml-1">{latest.unit}</span>
                            </>
                          ) : (
                            <span className="text-sm text-muted-foreground">--</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          {getTrendIcon(getTrend(k.key))}
                        </div>
                      </div>
                      {abnormality && (
                        <div className="mt-1">
                          <StatusBadge tone="danger" size="sm">
                            <AlertTriangle className="h-3 w-3 mr-0.5" />
                            {abnormality.status === "high" ? "High" : "Low"}
                          </StatusBadge>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Recent readings list */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Readings</CardTitle>
              </CardHeader>
              <CardContent>
              {list.isLoading ? (
                <Skeleton className="h-32 w-full" />
              ) : list.data && list.data.length > 0 ? (
                <ul className="divide-y divide-border">
                  <AnimatePresence initial={false}>
                  {list.data.map((v) => {
                    const k = KINDS.find((x) => x.key === v.kind);
                    const abnormality = abnormalities.find(a => a.kind === v.kind);
                    return (
                      <motion.li
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        key={v.id}
                        className={`flex items-center justify-between py-3 ${abnormality ? "bg-[var(--danger-soft)] -mx-3 px-3 rounded-lg" : ""}`}>
                        <div>
                          <div className="font-semibold text-sm flex items-center gap-2">
                            {k?.label || v.kind}
                            {abnormality && (
                              <StatusBadge tone="danger" size="sm">
                                {abnormality.status === "high" ? "High" : "Low"}
                              </StatusBadge>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">{format(new Date(v.taken_at), "PPp")}</div>
                        </div>
                        <div className="text-right">
                          <div className={`font-display text-xl font-bold ${getVitalStatusColor(abnormality?.status as any)}`}>
                            {v.value}
                            <span className="text-xs font-normal ml-1">{v.unit}</span>
                          </div>
                        </div>
                      </motion.li>
                    );
                  })}
                  </AnimatePresence>
                </ul>
              ) : (
                <EmptyState icon={Activity} title="No readings yet" body="Log your first vital to start seeing trends." />
              )}
              </CardContent>
            </Card>
            </motion.div>
          </TabsContent>

          <TabsContent value="trends">
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.15 }}
            >
            <Card>
              <CardHeader>
                <CardTitle>Trend Chart</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="mb-4">
                  <Select value={selectedKind} onValueChange={setSelectedKind}>
                    <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {KINDS.map((k) => <SelectItem key={k.key} value={k.key}>{k.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {chartData.length > 1 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                      <YAxis domain={['auto', 'auto']} />
                      <Tooltip 
                        contentStyle={{ 
                          background: 'var(--card)', 
                          border: '1px solid var(--border)', 
                          borderRadius: '0.75rem' 
                        }} 
                      />
                      <Line 
                        type="monotone" 
                        dataKey="value" 
                        stroke="var(--primary)" 
                        strokeWidth={2}
                        dot={{ fill: "var(--primary)" }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-center text-muted-foreground py-8">
                    Need at least 2 readings to show a trend
                  </p>
                )}
              </CardContent>
            </Card>
            </motion.div>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}