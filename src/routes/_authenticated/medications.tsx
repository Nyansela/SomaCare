import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Pill,
  Plus,
  ShieldCheck,
  AlertTriangle,
  X,
  CheckCircle,
  AlertCircle,
  Loader2,
  History,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, EmptyState } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge, medverifyTone } from "@/components/ui/status-badge";
import { InfoBanner } from "@/components/ui/info-banner";

export const Route = createFileRoute("/_authenticated/medications")({
  head: () => ({
    meta: [{ title: "Medications — SomaCare" }, { name: "robots", content: "noindex" }],
  }),
  component: Medications,
});

type VerifyResult = {
  allergy_check?: { status: string; details: string };
  interaction_check?: { status: string; details: string };
  condition_check?: { status: string; details: string };
  overall?: { status: string; summary: string };
  disclaimer: string;
  error?: { status: string; details: string };
};

function Medications() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [verifyMedName, setVerifyMedName] = useState("");
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    dose: "",
    frequency: "",
    scheduled_time: "",
    notes: "",
    rxcui: "",
  });
  const [drugSuggestions, setDrugSuggestions] = useState<Array<{ name: string; rxcui?: string }>>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Fetch medications
  const list = useQuery({
    queryKey: ["medications", "all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("medications")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch verify history
  const verifyHistory = useQuery({
    queryKey: ["medverify-checks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("medverify_checks")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
  });

  const handleNameChange = async (val: string) => {
    setForm((f) => ({ ...f, name: val, rxcui: "" }));
    if (val.trim().length < 2) {
      setDrugSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    try {
      const res = await fetch(`/api/medications/search?q=${encodeURIComponent(val)}`);
      if (res.ok) {
        const data = await res.json();
        setDrugSuggestions(data.results || []);
        setShowSuggestions(true);
      }
    } catch {
      // ignore
    }
  };

  const create = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const { error } = await supabase.from("medications").insert({
        user_id: u.user.id,
        name: form.name,
        dose: form.dose || null,
        frequency: form.frequency || null,
        scheduled_time: form.scheduled_time || null,
        notes: form.notes || null,
        rxcui: form.rxcui || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["medications"] });
      setOpen(false);
      setForm({ name: "", dose: "", frequency: "", scheduled_time: "", notes: "", rxcui: "" });
      toast.success("Medication added");
    },
    onError: (e) => toast.error(e.message),
  });

  const handleVerify = async () => {
    if (!verifyMedName.trim()) return;
    setVerifyLoading(true);
    setVerifyResult(null);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await fetch("/api/medverify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ medicationName: verifyMedName }),
      });

      if (!response.ok) {
        const err = await response.text();
        throw new Error(err || "Verification failed");
      }

      const result = await response.json();
      setVerifyResult(result);

      // Refresh history
      qc.invalidateQueries({ queryKey: ["medverify-checks"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setVerifyLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    if (status === "safe")
      return "bg-[var(--success-soft)] text-[var(--success-soft-foreground)] border-[var(--success)]/30";
    if (status === "caution")
      return "bg-[var(--warning-soft)] text-[var(--warning-soft-foreground)] border-[var(--warning)]/30";
    if (status === "unsafe")
      return "bg-[var(--danger-soft)] text-[var(--danger-soft-foreground)] border-[var(--destructive)]/30";
    return "bg-muted text-muted-foreground border-border";
  };

  const getStatusIcon = (status: string) => {
    if (status === "safe") return <CheckCircle className="h-5 w-5 text-[var(--success)]" />;
    if (status === "caution") return <AlertTriangle className="h-5 w-5 text-[var(--warning)]" />;
    if (status === "unsafe") return <AlertTriangle className="h-5 w-5 text-[var(--destructive)]" />;
    return <AlertCircle className="h-5 w-5 text-muted-foreground" />;
  };

  return (
    <AppShell
      title="Medications"
      subtitle="Prescriptions, reminders & interactions"
      action={
        <div className="flex gap-2">
          <Dialog open={verifyOpen} onOpenChange={setVerifyOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2">
                <ShieldCheck className="h-4 w-4" /> Verify Safety
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Verify Medication Safety</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="Enter medication name (e.g., Ibuprofen)"
                    value={verifyMedName}
                    onChange={(e) => setVerifyMedName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleVerify()}
                  />
                  <Button
                    onClick={handleVerify}
                    disabled={verifyLoading || !verifyMedName.trim()}
                    className="soma-gradient soma-glow border-0 text-white"
                  >
                    {verifyLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Check"}
                  </Button>
                </div>

                {verifyResult ? (
                  <>
                    {verifyResult.error ? (
                      <InfoBanner tone="danger">{verifyResult.error.details}</InfoBanner>
                    ) : (
                      <>
                        {/* Allergy Check */}
                        {verifyResult.allergy_check && (
                          <div
                            className={`p-3 rounded-lg border ${getStatusColor(verifyResult.allergy_check.status)}`}
                          >
                            <div className="flex items-center gap-2 font-medium">
                              {getStatusIcon(verifyResult.allergy_check.status)}
                              Allergy Check
                              <StatusBadge
                                tone={medverifyTone(verifyResult.allergy_check.status)}
                                size="sm"
                              >
                                {verifyResult.allergy_check.status}
                              </StatusBadge>
                            </div>
                            <p className="text-sm mt-1">{verifyResult.allergy_check.details}</p>
                          </div>
                        )}

                        {/* Interaction Check */}
                        {verifyResult.interaction_check && (
                          <div
                            className={`p-3 rounded-lg border ${getStatusColor(verifyResult.interaction_check.status)}`}
                          >
                            <div className="flex items-center gap-2 font-medium">
                              {getStatusIcon(verifyResult.interaction_check.status)}
                              Drug Interaction Check
                              <StatusBadge
                                tone={medverifyTone(verifyResult.interaction_check.status)}
                                size="sm"
                              >
                                {verifyResult.interaction_check.status}
                              </StatusBadge>
                            </div>
                            <p className="text-sm mt-1">{verifyResult.interaction_check.details}</p>
                          </div>
                        )}

                        {/* Condition Check */}
                        {verifyResult.condition_check && (
                          <div
                            className={`p-3 rounded-lg border ${getStatusColor(verifyResult.condition_check.status)}`}
                          >
                            <div className="flex items-center gap-2 font-medium">
                              {getStatusIcon(verifyResult.condition_check.status)}
                              Condition Risk Check
                              <StatusBadge
                                tone={medverifyTone(verifyResult.condition_check.status)}
                                size="sm"
                              >
                                {verifyResult.condition_check.status}
                              </StatusBadge>
                            </div>
                            <p className="text-sm mt-1">{verifyResult.condition_check.details}</p>
                          </div>
                        )}

                        {/* Overall */}
                        {verifyResult.overall && (
                          <div
                            className={`p-3 rounded-lg border ${getStatusColor(verifyResult.overall.status)}`}
                          >
                            <div className="flex items-center gap-2 font-semibold">
                              {getStatusIcon(verifyResult.overall.status)}
                              Overall Assessment:
                              <StatusBadge tone={medverifyTone(verifyResult.overall.status)}>
                                {verifyResult.overall.status.toUpperCase()}
                              </StatusBadge>
                            </div>
                            <p className="text-sm mt-1">{verifyResult.overall.summary}</p>
                          </div>
                        )}

                        {/* Disclaimer */}
                        <InfoBanner tone="warning">
                          <strong>Medical Disclaimer:</strong> {verifyResult.disclaimer}
                        </InfoBanner>
                      </>
                    )}
                  </>
                ) : null}
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="soma-gradient soma-glow border-0 text-white">
                <Plus className="mr-2 h-4 w-4" /> Add
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New medication</DialogTitle>
              </DialogHeader>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  create.mutate();
                }}
                className="space-y-4"
              >
                <div className="relative">
                  <Label>Name</Label>
                  <Input
                    required
                    value={form.name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    placeholder="Start typing medication name..."
                  />
                  {showSuggestions && drugSuggestions.length > 0 && (
                    <div className="absolute z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-md border border-border bg-popover p-1 shadow-md">
                      {drugSuggestions.map((s, idx) => (
                        <button
                          key={idx}
                          type="button"
                          className="w-full rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                          onClick={() => {
                            setForm({ ...form, name: s.name, rxcui: s.rxcui || "" });
                            setShowSuggestions(false);
                          }}
                        >
                          {s.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <Label>Dose</Label>
                  <Input
                    value={form.dose}
                    onChange={(e) => setForm({ ...form, dose: e.target.value })}
                    placeholder="e.g. 5mg"
                  />
                </div>
                <div>
                  <Label>Frequency</Label>
                  <Input
                    value={form.frequency}
                    onChange={(e) => setForm({ ...form, frequency: e.target.value })}
                    placeholder="e.g. 2x per day"
                  />
                </div>
                <div>
                  <Label>Scheduled Time (Reminder)</Label>
                  <Input
                    type="time"
                    value={form.scheduled_time}
                    onChange={(e) => setForm({ ...form, scheduled_time: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Notes</Label>
                  <Textarea
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  />
                </div>
                <DialogFooter>
                  <Button
                    type="submit"
                    disabled={create.isPending}
                    className="soma-gradient soma-glow border-0 text-white"
                  >
                    {create.isPending ? "Saving..." : "Save"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Medications List */}
        <Card>
          <CardHeader>
            <CardTitle>Your Medications</CardTitle>
          </CardHeader>
          <CardContent>
            {list.isLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : list.data && list.data.length > 0 ? (
              <ul className="grid gap-4 sm:grid-cols-2">
                <AnimatePresence initial={false}>
                  {list.data.map((m) => (
                    <motion.li
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      key={m.id}
                      className="flex items-center gap-4 rounded-2xl bg-surface-soft p-4"
                    >
                      <div
                        className="h-12 w-12 shrink-0 rounded-full soma-glow"
                        style={{
                          background:
                            "linear-gradient(135deg, oklch(0.66 0.16 278), oklch(0.6 0.19 278))",
                        }}
                      />
                      <div className="min-w-0">
                        <div className="font-semibold truncate">{m.name}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {[
                            m.dose,
                            m.frequency,
                            m.scheduled_time ? `Reminder: ${m.scheduled_time}` : null,
                          ]
                            .filter(Boolean)
                            .join(" · ") || "No schedule"}
                        </div>
                      </div>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            ) : (
              <EmptyState
                icon={Pill}
                title="No medications yet"
                body="Add your first prescription to unlock reminders and interaction checks."
              />
            )}
          </CardContent>
        </Card>

        {/* Verification History */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Past Safety Checks
            </CardTitle>
          </CardHeader>
          <CardContent>
            {verifyHistory.isLoading ? (
              <Skeleton className="h-20 w-full" />
            ) : verifyHistory.data && verifyHistory.data.length > 0 ? (
              <ul className="space-y-2">
                <AnimatePresence initial={false}>
                  {verifyHistory.data.map((check) => (
                    <motion.li
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      key={check.id}
                      className="flex items-center justify-between rounded-lg bg-muted/50 p-3"
                    >
                      <div>
                        <div className="font-medium">{check.medication_name}</div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(check.created_at).toLocaleString()}
                        </div>
                      </div>
                      <div className="text-sm text-muted-foreground text-right max-w-[200px] truncate">
                        {check.result_summary}
                      </div>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            ) : (
              <EmptyState
                icon={ShieldCheck}
                title="No safety checks yet"
                body='Use "Verify Safety" to check a medication.'
              />
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
