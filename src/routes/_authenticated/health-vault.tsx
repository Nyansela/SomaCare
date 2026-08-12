import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Save,
  Loader2,
  Pencil,
  User,
  MapPin,
  Phone,
  AlertCircle,
  Plus,
  X,
  Heart,
  GlassWater,
  Utensils,
  Target,
  AlertTriangle,
  Stethoscope,
  Syringe,
  Users,
  FileDown,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, EmptyState } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";
import {
  GENDER_OPTIONS,
  SMOKING_STATUS_OPTIONS,
  ALCOHOL_USE_OPTIONS,
  DIETARY_PREFERENCE_OPTIONS,
  HEALTH_GOALS_OPTIONS,
  ALLERGY_SEVERITY_OPTIONS,
  MEDICAL_EVENT_TYPE_OPTIONS,
} from "@/integrations/supabase/health-vault";
import { HealthReportPDF } from "@/components/reports/HealthReportPDF";
import { HealthVaultShareManager } from "@/components/health-vault/HealthVaultShareManager";
import { pdf } from "@react-pdf/renderer";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/health-vault")({
  component: HealthVaultPage,
});

function HealthVaultPage() {
  return <HealthVaultContent />;
}

type FormData = {
  displayName: string;
  age: string;
  gender: string;
  bodyWeight: string;
  dateOfBirth: string;
  bloodType: string;
  height: string;
  country: string;
  city: string;
  chronicConditions: string;
  pastIllnesses: string;
  hereditaryDiseases: string;
  emergencyName: string;
  emergencyPhone: string;
  // New fields
  smokingStatus: string;
  alcoholUse: string;
  dietaryPreference: string;
  dietaryPreferenceOther: string;
  healthGoals: string[];
  isPregnant: boolean | null;
};

// Query keys for health vault data
const healthVaultQueryKeys = {
  profiles: () => ["health_vault", "profiles"] as const,
  healthVault: () => ["health_vault", "record"] as const,
  allergies: () => ["health_vault", "allergies"] as const,
  events: () => ["health_vault", "events"] as const,
};

type AllergyEntry = {
  id?: string;
  allergen: string;
  reaction: string;
  severity: string;
};

type MedicalEventEntry = {
  id?: string;
  event_type: string;
  description: string;
  related_person: string;
  event_date: string;
};

function severityTone(severity: string): StatusTone {
  if (severity === "life_threatening" || severity === "severe") return "danger";
  if (severity === "moderate") return "warning";
  return "success";
}

const emptyForm: FormData = {
  displayName: "",
  age: "",
  gender: "",
  bodyWeight: "",
  dateOfBirth: "",
  bloodType: "",
  height: "",
  country: "",
  city: "",
  chronicConditions: "",
  pastIllnesses: "",
  hereditaryDiseases: "",
  emergencyName: "",
  emergencyPhone: "",
  smokingStatus: "",
  alcoholUse: "",
  dietaryPreference: "",
  dietaryPreferenceOther: "",
  healthGoals: [],
  isPregnant: null,
};

function HealthVaultContent() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [data, setData] = useState<FormData>(emptyForm);
  const [allergies, setAllergies] = useState<AllergyEntry[]>([]);
  const [medicalEvents, setMedicalEvents] = useState<MedicalEventEntry[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  // Modal states
  const [showAllergyModal, setShowAllergyModal] = useState(false);
  const [showEventModal, setShowEventModal] = useState(false);
  const [editingAllergy, setEditingAllergy] = useState<AllergyEntry | null>(null);
  const [editingEvent, setEditingEvent] = useState<MedicalEventEntry | null>(null);

  // Fetch all health-vault data in one query (same requests as before)
  const vaultQuery = useQuery({
    queryKey: ["health-vault"],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const [profileRes, healthVaultRes, allergiesRes, eventsRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
        supabase.from("health_vault").select("*").eq("user_id", user.id).maybeSingle(),
        supabase
          .from("allergies")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("medical_history_events")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
      ]);

      return {
        profile: profileRes.data,
        healthVault: healthVaultRes.data,
        allergies: allergiesRes.data || [],
        events: eventsRes.data || [],
      };
    },
  });
  const loading = vaultQuery.isLoading;

  // Seed the editable form/local lists whenever fresh data arrives
  // (matches the previous loadHealthData re-seed behavior).
  useEffect(() => {
    if (!vaultQuery.data) return;
    const { profile, healthVault, allergies: allergiesData, events } = vaultQuery.data;

    setData({
      displayName: profile?.display_name || "",
      dateOfBirth: profile?.date_of_birth || "",
      bloodType: profile?.blood_type || "",
      height: profile?.height_cm?.toString() || "",
      gender: healthVault?.gender || profile?.sex || "",
      age: healthVault?.age?.toString() || "",
      bodyWeight: healthVault?.body_weight_kg?.toString() || "",
      country: healthVault?.country || "",
      city: healthVault?.city || "",
      chronicConditions: (
        healthVault?.chronic_conditions ||
        profile?.chronic_conditions ||
        []
      ).join(", "),
      pastIllnesses: (healthVault?.past_illnesses || []).join(", "),
      hereditaryDiseases: (healthVault?.hereditary_diseases || []).join(", "),
      emergencyName: healthVault?.emergency_contact_name || "",
      emergencyPhone: healthVault?.emergency_contact_phone || "",
      smokingStatus: healthVault?.smoking_status || "",
      alcoholUse: healthVault?.alcohol_use || "",
      dietaryPreference: healthVault?.dietary_preference || "",
      dietaryPreferenceOther: healthVault?.dietary_preference_other || "",
      healthGoals: healthVault?.health_goals || [],
      isPregnant: healthVault?.is_pregnant ?? null,
    });

    // Load structured allergies
    setAllergies(
      allergiesData.map((a) => ({
        id: a.id,
        allergen: a.allergen,
        reaction: a.reaction || "",
        severity: a.severity || "",
      })),
    );

    // Load medical events
    setMedicalEvents(
      events.map((e) => ({
        id: e.id,
        event_type: e.event_type,
        description: e.description,
        related_person: e.related_person || "",
        event_date: e.event_date || "",
      })),
    );
  }, [vaultQuery.data]);

  const updateField = (field: keyof FormData, value: string | string[] | boolean | null) => {
    setData((prev) => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const toggleHealthGoal = (goal: string) => {
    const current = data.healthGoals || [];
    const updated = current.includes(goal) ? current.filter((g) => g !== goal) : [...current, goal];
    updateField("healthGoals", updated);
  };

  const parseArray = (value: string): string[] => {
    return value
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Update profile
      await supabase
        .from("profiles")
        .update({
          display_name: data.displayName || null,
          date_of_birth: data.dateOfBirth || null,
          blood_type: data.bloodType || null,
          height_cm: data.height ? parseFloat(data.height) : null,
          sex: data.gender || null,
        })
        .eq("id", user.id);

      // Upsert health vault
      await supabase.from("health_vault").upsert({
        user_id: user.id,
        age: data.age ? parseInt(data.age) : null,
        body_weight_kg: data.bodyWeight ? parseFloat(data.bodyWeight) : null,
        gender: data.gender || null,
        country: data.country || null,
        city: data.city || null,
        // Keep the legacy health_vault.allergies column in sync with the
        // structured allergies table (source of truth on this page); it is
        // still read by /api/nutrition for allergy-safe meal plans.
        allergies: allergies.map((a) => a.allergen),
        chronic_conditions: parseArray(data.chronicConditions),
        past_illnesses: parseArray(data.pastIllnesses),
        hereditary_diseases: parseArray(data.hereditaryDiseases),
        emergency_contact_name: data.emergencyName || null,
        emergency_contact_phone: data.emergencyPhone || null,
        smoking_status: data.smokingStatus || null,
        alcohol_use: data.alcoholUse || null,
        dietary_preference: data.dietaryPreference || null,
        dietary_preference_other: data.dietaryPreferenceOther || null,
        health_goals: data.healthGoals || [],
        is_pregnant: data.isPregnant,
      });
    },
    onSuccess: () => {
      toast.success("Health profile updated!");
      setHasChanges(false);
      qc.invalidateQueries({ queryKey: ["health-vault"] });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    },
  });

  const handleSave = () => saveMutation.mutate();
  const saving = saveMutation.isPending;

  // Allergy handlers

  // Mirror the structured allergies into the legacy health_vault.allergies
  // column immediately — /api/nutrition (and MedVerify context fallbacks)
  // read it for allergy-safety checks, so it must never lag behind.
  const syncLegacyAllergies = async (userId: string, list: AllergyEntry[]) => {
    await supabase
      .from("health_vault")
      .update({ allergies: list.map((a) => a.allergen) })
      .eq("user_id", userId);
  };

  const addAllergyMutation = useMutation({
    mutationFn: async (entry: AllergyEntry) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      if (entry.id) {
        // Update existing
        await supabase
          .from("allergies")
          .update({
            allergen: entry.allergen,
            reaction: entry.reaction || null,
            severity: entry.severity,
          })
          .eq("id", entry.id);
      } else {
        // Insert new
        await supabase.from("allergies").insert({
          user_id: user.id,
          allergen: entry.allergen,
          reaction: entry.reaction || null,
          severity: entry.severity,
        });
      }

      const nextAllergies = entry.id
        ? allergies.map((a) => (a.id === entry.id ? entry : a))
        : [...allergies, entry];
      await syncLegacyAllergies(user.id, nextAllergies);
      return entry;
    },
    onSuccess: (entry) => {
      qc.invalidateQueries({ queryKey: ["health-vault"] });
      setShowAllergyModal(false);
      setEditingAllergy(null);
      toast.success(entry.id ? "Allergy updated" : "Allergy added");
    },
    onError: () => {
      toast.error("Failed to save allergy");
    },
  });

  const handleAddAllergy = () => {
    if (!editingAllergy?.allergen || !editingAllergy.severity) {
      toast.error("Please fill in allergen and severity");
      return;
    }
    addAllergyMutation.mutate(editingAllergy);
  };

  const deleteAllergyMutation = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("allergies").delete().eq("id", id);
      return id;
    },
    onSuccess: (id) => {
      setAllergies(allergies.filter((a) => a.id !== id));
      qc.invalidateQueries({ queryKey: ["health-vault"] });
      toast.success("Allergy removed");
    },
    onError: () => {
      toast.error("Failed to delete allergy");
    },
  });

  const handleDeleteAllergy = (id: string) => deleteAllergyMutation.mutate(id);

  // Medical event handlers
  const addEventMutation = useMutation({
    mutationFn: async (entry: MedicalEventEntry) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      if (entry.id) {
        await supabase
          .from("medical_history_events")
          .update({
            event_type: entry.event_type,
            description: entry.description,
            related_person: entry.related_person || null,
            event_date: entry.event_date || null,
          })
          .eq("id", entry.id);
      } else {
        await supabase.from("medical_history_events").insert({
          user_id: user.id,
          event_type: entry.event_type,
          description: entry.description,
          related_person: entry.related_person || null,
          event_date: entry.event_date || null,
        });
      }
      return entry;
    },
    onSuccess: (entry) => {
      qc.invalidateQueries({ queryKey: ["health-vault"] });
      setShowEventModal(false);
      setEditingEvent(null);
      toast.success(entry.id ? "Event updated" : "Event added");
    },
    onError: () => {
      toast.error("Failed to save event");
    },
  });

  const handleAddEvent = () => {
    if (!editingEvent?.event_type || !editingEvent.description) {
      toast.error("Please fill in event type and description");
      return;
    }
    addEventMutation.mutate(editingEvent);
  };

  const deleteEventMutation = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("medical_history_events").delete().eq("id", id);
      return id;
    },
    onSuccess: (id) => {
      setMedicalEvents(medicalEvents.filter((e) => e.id !== id));
      qc.invalidateQueries({ queryKey: ["health-vault"] });
      toast.success("Event removed");
    },
    onError: () => {
      toast.error("Failed to delete event");
    },
  });

  const handleDeleteEvent = (id: string) => deleteEventMutation.mutate(id);

  // Fetch recent vitals and activity summary for the PDF
  const { data: healthContext } = useQuery({
    queryKey: ["health-vault-context"],
    queryFn: async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");

        // Fetch recent vitals (last 30 days) — key/value schema (kind, value, unit, taken_at)
        const { data: vitalsData, error: vitalsError } = await supabase
          .from("vitals")
          .select("*")
          .eq("user_id", user.id)
          .gte("taken_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
          .order("taken_at", { ascending: false });
        if (vitalsError) console.warn("Failed to fetch vitals:", vitalsError.message);

        // Fetch sleep logs (last 14 days) — hours are derived from bedtime/wake_time
        const { data: sleepData, error: sleepError } = await supabase
          .from("sleep_logs")
          .select("bedtime, wake_time, logged_date")
          .eq("user_id", user.id)
          .gte("logged_date", new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString())
          .order("logged_date", { ascending: false });
        if (sleepError) console.warn("Failed to fetch sleep logs:", sleepError.message);

        // Fetch hydration logs (last 14 days) — the column is amount_ml
        const { data: hydrationData, error: hydrationError } = await supabase
          .from("hydration_logs")
          .select("amount_ml, logged_at")
          .eq("user_id", user.id)
          .gte("logged_at", new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString())
          .order("logged_at", { ascending: false });
        if (hydrationError) console.warn("Failed to fetch hydration logs:", hydrationError.message);

        // Fetch fitness logs (last 14 days)
        const { data: fitnessData, error: fitnessError } = await supabase
          .from("fitness_logs")
          .select("duration_minutes, logged_date")
          .eq("user_id", user.id)
          .gte("logged_date", new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString())
          .order("logged_date", { ascending: false });
        if (fitnessError) console.warn("Failed to fetch fitness logs:", fitnessError.message);

        // Calculate activity summary (fallback to empty data if queries fail)
        const sleepList = sleepData ?? [];
        const sleepSummary = {
          averageHours:
            sleepList.length > 0
              ? sleepList.reduce((sum, log) => {
                  const bed = new Date(log.bedtime).getTime();
                  const wake = new Date(log.wake_time).getTime();
                  let hours = (wake - bed) / (1000 * 60 * 60);
                  if (hours < 0) hours += 24; // overnight sleep
                  return sum + hours;
                }, 0) / sleepList.length
              : 0,
          nightsLogged: sleepList.length,
        };

        const hydrationList = hydrationData ?? [];
        const hydrationSummary = {
          averageIntake:
            hydrationList.length > 0
              ? hydrationList.reduce((sum, log) => sum + log.amount_ml, 0) / hydrationList.length
              : 0,
          daysLogged: hydrationList.length,
        };

        const fitnessList = fitnessData ?? [];
        const fitnessSummary = {
          totalWorkouts: fitnessList.length,
          totalMinutes: fitnessList.reduce((sum, log) => sum + log.duration_minutes, 0),
        };

        return {
          vitals: vitalsData || [],
          activitySummary: {
            sleep: sleepSummary,
            hydration: hydrationSummary,
            fitness: fitnessSummary,
          },
        };
      } catch (error) {
        console.error("Failed to fetch health context:", error);
        // Return fallback data to prevent page crash
        return {
          vitals: [],
          activitySummary: {
            sleep: { averageHours: 0, nightsLogged: 0 },
            hydration: { averageIntake: 0, daysLogged: 0 },
            fitness: { totalWorkouts: 0, totalMinutes: 0 },
          },
        };
      }
    },
  });

  // Generate and download the PDF
  const handleGenerateReport = async () => {
    if (!vaultQuery.data || !healthContext) {
      toast.error("Health data is still loading. Please try again.");
      return;
    }

    const { profile, healthVault, allergies: allergiesData, events } = vaultQuery.data;
    const { vitals, activitySummary } = healthContext;

    // Format data for the PDF
    const pdfData = {
      profile: {
        name: profile?.display_name || "Not specified",
        age: data.age ? parseInt(data.age) : undefined,
        gender: data.gender || "Not specified",
        bloodType: data.bloodType || "Not specified",
        height: data.height ? parseFloat(data.height) : undefined,
        weight: data.bodyWeight ? parseFloat(data.bodyWeight) : undefined,
        bmi:
          data.bodyWeight && data.height
            ? parseFloat(data.bodyWeight) / Math.pow(parseFloat(data.height) / 100, 2)
            : undefined,
      },
      allergies: allergiesData.map((a) => ({
        name: a.allergen,
        severity:
          ALLERGY_SEVERITY_OPTIONS.find((opt) => opt.value === a.severity)?.label || a.severity,
      })),
      chronicConditions: parseArray(data.chronicConditions).map((name) => ({ name })),
      medicalHistoryEvents: events.map((e) => ({
        type:
          MEDICAL_EVENT_TYPE_OPTIONS.find((opt) => opt.value === e.event_type)?.label ||
          e.event_type,
        name: e.description,
        date: e.event_date || undefined,
        notes: e.related_person ? `Related to: ${e.related_person}` : undefined,
      })),
      medications: [], // Placeholder for future medication data
      // vitals are stored as key/value rows (kind, value, unit, taken_at), so
      // group by day and map each kind to the PDF's wide shape.
      vitals: (() => {
        const byDay = new Map<string, Record<string, number>>();
        vitals.forEach((v) => {
          const day = v.taken_at.split("T")[0];
          const entry = byDay.get(day) || {};
          entry[v.kind] = v.value;
          byDay.set(day, entry);
        });
        return Array.from(byDay.entries()).map(([date, vals]) => ({
          date,
          bloodPressure:
            vals.bp_sys != null && vals.bp_dia != null
              ? { systolic: vals.bp_sys, diastolic: vals.bp_dia }
              : undefined,
          heartRate: vals.heart_rate,
          glucose: vals.glucose,
          weight: vals.weight,
          oxygenSaturation: vals.spo2,
          temperature: vals.temperature,
          abnormal: false,
        }));
      })(),
      activitySummary,
    };

    // Trigger download
    try {
      const docInstance = pdf(<HealthReportPDF {...pdfData} />);
      const blob = await docInstance.toBlob();
      if (!blob || !(blob instanceof Blob)) {
        throw new Error("Generated PDF document is not a valid Blob");
      }
      const pdfUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = pdfUrl;
      link.download = `SomaCare_Health_Report_${format(new Date(), "yyyyMMdd_HHmmss")}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(pdfUrl);
      toast.success("Health report downloaded successfully!");
    } catch (error) {
      console.error("PDF generation error details:", {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        error,
      });
      toast.error(
        `Failed to generate PDF: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  };

  const openAllergyModal = (allergy?: AllergyEntry) => {
    setEditingAllergy(allergy || { allergen: "", reaction: "", severity: "" });
    setShowAllergyModal(true);
  };

  const openEventModal = (event?: MedicalEventEntry) => {
    setEditingEvent(
      event || { event_type: "", description: "", related_person: "", event_date: "" },
    );
    setShowEventModal(true);
  };

  if (loading) {
    return (
      <AppShell
        title={t("healthVault.title", "Health Vault")}
        subtitle={t("healthVault.subtitle", "Your comprehensive health profile")}
      >
        <div className="grid gap-6 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-64 rounded-2xl" />
          ))}
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      title={t("healthVault.title", "Health Vault")}
      subtitle={t("healthVault.subtitle", "Your comprehensive health profile")}
      action={
        <div className="flex gap-2">
          <Button
            onClick={handleGenerateReport}
            disabled={vaultQuery.isLoading || !vaultQuery.data}
            className="soma-gradient soma-glow border-0 text-white"
          >
            <FileDown className="mr-2 h-4 w-4" />
            {t("healthVault.generateReport", "Generate Report")}
          </Button>
          <Button
            onClick={handleSave}
            disabled={!hasChanges || saving}
            className="soma-gradient soma-glow border-0 text-white"
          >
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            {t("healthVault.saveChanges", "Save Changes")}
          </Button>
        </div>
      }
    >
      <div className="grid gap-6 md:grid-cols-2">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              {t("healthVault.basicInformation", "Basic Information")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="displayName">{t("healthVault.displayName", "Display Name")}</Label>
              <Input
                id="displayName"
                value={data.displayName}
                onChange={(e) => updateField("displayName", e.target.value)}
                className="mt-1.5"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="age">{t("healthVault.age", "Age")}</Label>
                <Input
                  id="age"
                  type="number"
                  value={data.age}
                  onChange={(e) => updateField("age", e.target.value)}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="gender">{t("healthVault.gender", "Gender")}</Label>
                <Select value={data.gender} onValueChange={(v) => updateField("gender", v)}>
                  <SelectTrigger id="gender" className="mt-1.5 w-full">
                    <SelectValue placeholder={t("healthVault.select", "Select...")} />
                  </SelectTrigger>
                  <SelectContent>
                    {GENDER_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="bodyWeight">{t("healthVault.weight", "Weight (kg)")}</Label>
                <Input
                  id="bodyWeight"
                  type="number"
                  step="0.1"
                  value={data.bodyWeight}
                  onChange={(e) => updateField("bodyWeight", e.target.value)}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="height">{t("healthVault.height", "Height (cm)")}</Label>
                <Input
                  id="height"
                  type="number"
                  value={data.height}
                  onChange={(e) => updateField("height", e.target.value)}
                  className="mt-1.5"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="dateOfBirth">{t("healthVault.dateOfBirth", "Date of Birth")}</Label>
                <Input
                  id="dateOfBirth"
                  type="date"
                  value={data.dateOfBirth}
                  onChange={(e) => updateField("dateOfBirth", e.target.value)}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="bloodType">{t("healthVault.bloodType", "Blood Type")}</Label>
                <Select value={data.bloodType} onValueChange={(v) => updateField("bloodType", v)}>
                  <SelectTrigger id="bloodType" className="mt-1.5 w-full">
                    <SelectValue placeholder={t("healthVault.select", "Select...")} />
                  </SelectTrigger>
                  <SelectContent>
                    {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((bt) => (
                      <SelectItem key={bt} value={bt}>
                        {bt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {data.gender === "female" && (
              <div className="flex items-center gap-2">
                <Checkbox
                  id="isPregnant"
                  checked={data.isPregnant === true}
                  onCheckedChange={(v) => updateField("isPregnant", v ? true : false)}
                />
                <Label htmlFor="isPregnant" className="text-sm">
                  {t("healthVault.currentlyPregnant", "Currently pregnant")}
                </Label>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Location */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              {t("healthVault.location", "Location")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="country">{t("healthVault.country", "Country")}</Label>
              <Input
                id="country"
                value={data.country}
                onChange={(e) => updateField("country", e.target.value)}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="city">{t("healthVault.city", "City")}</Label>
              <Input
                id="city"
                value={data.city}
                onChange={(e) => updateField("city", e.target.value)}
                className="mt-1.5"
              />
            </div>
          </CardContent>
        </Card>

        {/* Lifestyle */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Heart className="h-5 w-5" />
              {t("healthVault.lifestyle", "Lifestyle")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="smokingStatus">
                {t("healthVault.smokingStatus", "Smoking Status")}
              </Label>
              <Select
                value={data.smokingStatus}
                onValueChange={(v) => updateField("smokingStatus", v)}
              >
                <SelectTrigger id="smokingStatus" className="mt-1.5 w-full">
                  <SelectValue placeholder={t("healthVault.select", "Select...")} />
                </SelectTrigger>
                <SelectContent>
                  {SMOKING_STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="alcoholUse">{t("healthVault.alcoholUse", "Alcohol Use")}</Label>
              <Select value={data.alcoholUse} onValueChange={(v) => updateField("alcoholUse", v)}>
                <SelectTrigger id="alcoholUse" className="mt-1.5 w-full">
                  <SelectValue placeholder={t("healthVault.select", "Select...")} />
                </SelectTrigger>
                <SelectContent>
                  {ALCOHOL_USE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="dietaryPreference">
                {t("healthVault.dietaryPreference", "Dietary Preference")}
              </Label>
              <Select
                value={data.dietaryPreference}
                onValueChange={(v) => updateField("dietaryPreference", v)}
              >
                <SelectTrigger id="dietaryPreference" className="mt-1.5 w-full">
                  <SelectValue placeholder={t("healthVault.select", "Select...")} />
                </SelectTrigger>
                <SelectContent>
                  {DIETARY_PREFERENCE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {data.dietaryPreference === "other" && (
              <div>
                <Label htmlFor="dietaryPreferenceOther">
                  {t("healthVault.specifyDietaryPreference", "Specify other dietary preference")}
                </Label>
                <Input
                  id="dietaryPreferenceOther"
                  placeholder={t("healthVault.placeholderDietaryOther", "e.g., Vegetarian, Kosher")}
                  value={data.dietaryPreferenceOther}
                  onChange={(e) => updateField("dietaryPreferenceOther", e.target.value)}
                  className="mt-1.5"
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Health Goals */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              {t("healthVault.healthGoals", "Health Goals")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2">
              {HEALTH_GOALS_OPTIONS.map((goal) => (
                <div key={goal.value} className="flex items-center gap-2">
                  <Checkbox
                    id={goal.value}
                    checked={data.healthGoals.includes(goal.value)}
                    onCheckedChange={() => toggleHealthGoal(goal.value)}
                  />
                  <Label htmlFor={goal.value} className="text-sm cursor-pointer">
                    {goal.label}
                  </Label>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Allergies */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              {t("healthVault.allergies", "Allergies")}
            </CardTitle>
            <Button size="sm" variant="outline" onClick={() => openAllergyModal()}>
              <Plus className="h-4 w-4 mr-1" /> {t("healthVault.add", "Add")}
            </Button>
          </CardHeader>
          <CardContent>
            {allergies.length === 0 ? (
              <EmptyState
                icon={AlertTriangle}
                title={t("healthVault.noAllergies", "No allergies added yet")}
              />
            ) : (
              <div className="space-y-2">
                {allergies.map((allergy) => (
                  <div
                    key={allergy.id}
                    className="flex items-center justify-between rounded-lg bg-muted/50 p-3"
                  >
                    <div>
                      <div className="font-medium">{allergy.allergen}</div>
                      {allergy.reaction && (
                        <div className="text-sm text-muted-foreground">{allergy.reaction}</div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge tone={severityTone(allergy.severity)}>
                        {allergy.severity}
                      </StatusBadge>
                      <Button size="icon" variant="ghost" onClick={() => openAllergyModal(allergy)}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleDeleteAllergy(allergy.id!)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Medical History Events */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Stethoscope className="h-5 w-5" />
              {t("healthVault.medicalHistory", "Medical History")}
            </CardTitle>
            <Button size="sm" variant="outline" onClick={() => openEventModal()}>
              <Plus className="h-4 w-4 mr-1" /> {t("healthVault.add", "Add")}
            </Button>
          </CardHeader>
          <CardContent>
            {medicalEvents.length === 0 ? (
              <EmptyState
                icon={Stethoscope}
                title={t("healthVault.noMedicalHistory", "No medical history added yet")}
              />
            ) : (
              <div className="space-y-3">
                {MEDICAL_EVENT_TYPE_OPTIONS.map((type) => {
                  const eventsOfType = medicalEvents.filter((e) => e.event_type === type.value);
                  if (eventsOfType.length === 0) return null;
                  return (
                    <div key={type.value}>
                      <div className="text-sm font-medium text-muted-foreground mb-1 flex items-center gap-1">
                        {type.value === "surgery" && <Stethoscope className="h-3 w-3" />}
                        {type.value === "immunization" && <Syringe className="h-3 w-3" />}
                        {type.value === "family_history" && <Users className="h-3 w-3" />}
                        {type.label}
                      </div>
                      {eventsOfType.map((event) => (
                        <div
                          key={event.id}
                          className="flex items-center justify-between rounded-lg bg-muted/50 p-3 ml-4"
                        >
                          <div>
                            <div className="font-medium">{event.description}</div>
                            <div className="text-sm text-muted-foreground">
                              {event.related_person && `${event.related_person} • `}
                              {event.event_date}
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => openEventModal(event)}
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleDeleteEvent(event.id!)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Legacy fields - kept for backward compatibility */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              {t("healthVault.medicalHistoryLegacy", "Medical History (Legacy)")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="chronicConditions">
                {t("healthVault.chronicConditions", "Chronic Conditions (comma-separated)")}
              </Label>
              <Input
                id="chronicConditions"
                placeholder={t("healthVault.placeholderChronic", "Diabetes, Hypertension, Asthma")}
                value={data.chronicConditions}
                onChange={(e) => updateField("chronicConditions", e.target.value)}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="pastIllnesses">
                {t("healthVault.pastIllnesses", "Past Illnesses (comma-separated)")}
              </Label>
              <Input
                id="pastIllnesses"
                placeholder={t("healthVault.placeholderPastIllnesses", "COVID-19, Appendectomy")}
                value={data.pastIllnesses}
                onChange={(e) => updateField("pastIllnesses", e.target.value)}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="hereditaryDiseases">
                {t("healthVault.hereditaryDiseases", "Hereditary Diseases (comma-separated)")}
              </Label>
              <Input
                id="hereditaryDiseases"
                placeholder={t("healthVault.placeholderHereditary", "Heart disease, Cancer")}
                value={data.hereditaryDiseases}
                onChange={(e) => updateField("hereditaryDiseases", e.target.value)}
                className="mt-1.5"
              />
            </div>
          </CardContent>
        </Card>

        {/* Emergency Contact */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5" />
              {t("healthVault.emergencyContact", "Emergency Contact")}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="emergencyName">{t("healthVault.contactName", "Contact Name")}</Label>
              <Input
                id="emergencyName"
                value={data.emergencyName}
                onChange={(e) => updateField("emergencyName", e.target.value)}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="emergencyPhone">{t("healthVault.phoneNumber", "Phone Number")}</Label>
              <Input
                id="emergencyPhone"
                type="tel"
                value={data.emergencyPhone}
                onChange={(e) => updateField("emergencyPhone", e.target.value)}
                className="mt-1.5"
              />
            </div>
          </CardContent>
        </Card>

        {/* Share with Doctor */}
        <HealthVaultShareManager />
      </div>

      {/* Allergy Modal */}
      <Dialog
        open={showAllergyModal}
        onOpenChange={(open) => {
          if (!open) {
            setShowAllergyModal(false);
            setEditingAllergy(null);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingAllergy?.id
                ? t("healthVault.editAllergy", "Edit Allergy")
                : t("healthVault.addAllergy", "Add Allergy")}
            </DialogTitle>
          </DialogHeader>
          {editingAllergy && (
            <div className="space-y-4">
              <div>
                <Label>{t("healthVault.allergen", "Allergen")} *</Label>
                <Input
                  value={editingAllergy.allergen}
                  onChange={(e) =>
                    setEditingAllergy({ ...editingAllergy, allergen: e.target.value })
                  }
                  placeholder={t("healthVault.placeholderAllergen", "e.g., Peanuts")}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label>{t("healthVault.severity", "Severity")} *</Label>
                <Select
                  value={editingAllergy.severity}
                  onValueChange={(v) => setEditingAllergy({ ...editingAllergy, severity: v })}
                >
                  <SelectTrigger className="mt-1.5 w-full">
                    <SelectValue placeholder={t("healthVault.select", "Select severity...")} />
                  </SelectTrigger>
                  <SelectContent>
                    {ALLERGY_SEVERITY_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label} - {opt.description}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t("healthVault.reaction", "Reaction")}</Label>
                <Input
                  value={editingAllergy.reaction}
                  onChange={(e) =>
                    setEditingAllergy({ ...editingAllergy, reaction: e.target.value })
                  }
                  placeholder={t("healthVault.placeholderReaction", "e.g., Hives, swelling")}
                  className="mt-1.5"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowAllergyModal(false);
                setEditingAllergy(null);
              }}
            >
              {t("healthVault.cancel", "Cancel")}
            </Button>
            <Button
              onClick={handleAddAllergy}
              className="soma-gradient soma-glow border-0 text-white"
            >
              {editingAllergy?.id ? t("healthVault.update", "Update") : t("healthVault.add", "Add")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Event Modal */}
      <Dialog
        open={showEventModal}
        onOpenChange={(open) => {
          if (!open) {
            setShowEventModal(false);
            setEditingEvent(null);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingEvent?.id
                ? t("healthVault.editEvent", "Edit Event")
                : t("healthVault.addMedicalEvent", "Add Medical Event")}
            </DialogTitle>
          </DialogHeader>
          {editingEvent && (
            <div className="space-y-4">
              <div>
                <Label>{t("healthVault.eventType", "Event Type")} *</Label>
                <Select
                  value={editingEvent.event_type}
                  onValueChange={(v) => setEditingEvent({ ...editingEvent, event_type: v })}
                >
                  <SelectTrigger className="mt-1.5 w-full">
                    <SelectValue placeholder={t("healthVault.select", "Select type...")} />
                  </SelectTrigger>
                  <SelectContent>
                    {MEDICAL_EVENT_TYPE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t("healthVault.description", "Description")} *</Label>
                <Input
                  value={editingEvent.description}
                  onChange={(e) =>
                    setEditingEvent({ ...editingEvent, description: e.target.value })
                  }
                  placeholder="e.g., Appendectomy, Flu shot"
                  className="mt-1.5"
                />
              </div>
              {editingEvent.event_type === "family_history" && (
                <div>
                  <Label>{t("healthVault.relatedFamilyMember", "Related Family Member")}</Label>
                  <Input
                    value={editingEvent.related_person}
                    onChange={(e) =>
                      setEditingEvent({ ...editingEvent, related_person: e.target.value })
                    }
                    placeholder="e.g., Mother, Father"
                    className="mt-1.5"
                  />
                </div>
              )}
              <div>
                <Label>{t("healthVault.date", "Date")}</Label>
                <Input
                  type="date"
                  value={editingEvent.event_date}
                  onChange={(e) => setEditingEvent({ ...editingEvent, event_date: e.target.value })}
                  className="mt-1.5"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowEventModal(false);
                setEditingEvent(null);
              }}
            >
              {t("healthVault.cancel", "Cancel")}
            </Button>
            <Button
              onClick={handleAddEvent}
              className="soma-gradient soma-glow border-0 text-white"
            >
              {editingEvent?.id ? t("healthVault.update", "Update") : t("healthVault.add", "Add")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
