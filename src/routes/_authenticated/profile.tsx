"use client";

import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Info } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  User,
  Heart,
  Shield,
  Palette,
  Bell,
  Globe,
  Volume2,
  Save,
  Loader2,
  Camera,
  Calendar,
  Droplets,
  Ruler,
  Phone,
  MapPin,
  Stethoscope,
  FileText,
  Download,
  Trash2,
  AlertTriangle,
  Activity,
  Moon,
  Dumbbell,
  Lock,
  Accessibility,
  Link,
  ShieldCheck,
  Mail,
  Pill,
} from "lucide-react";
import {
  applyTheme as applyStoreTheme,
  DEFAULT_THEME,
  saveTheme,
  type ThemeSettings,
} from "@/lib/theme-store";
import { ThemeSettingsPanel } from "@/components/theme-settings-panel";
import i18n from "@/i18n";
import { useTranslation } from "react-i18next";
import {
  requestNotificationPermissions,
  scheduleMedicationNotifications,
  scheduleDailyCheckInNotification,
  cancelAllNotifications,
} from "@/lib/notifications";

export const Route = createFileRoute("/_authenticated/profile")({
  component: ProfilePage,
});

type EmergencyContact = { name?: string; phone?: string; relation?: string };

// ---------------------------------------------------------------------------
// Tab definitions — merged from profile + settings
// ---------------------------------------------------------------------------
const TABS = [
  { id: "identity", label: "Identity", icon: User },
  { id: "clinical", label: "Clinical", icon: Stethoscope },
  { id: "preferences", label: "Preferences", icon: Palette },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "privacy", label: "Privacy", icon: Shield },
  { id: "integrations", label: "Integrations", icon: Link },
  { id: "account", label: "Account", icon: Lock },
] as const;

function ProfilePage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState("identity");
  const [hasChanges, setHasChanges] = useState(false);

  // ── Identity & Basics state ────────────────────────────────────────
  const [identity, setIdentity] = useState({
    display_name: "",
    date_of_birth: "",
    sex: "",
    avatar_url: "",
    locale: "en",
    location_region: "",
  });

  // ── Clinical Profile state ─────────────────────────────────────────
  const [clinical, setClinical] = useState({
    blood_type: "",
    height_cm: "",
    allergies: "" as string,
    chronic_conditions: "" as string,
    emergency_name: "",
    emergency_phone: "",
    emergency_relation: "",
  });

  // ── Preferences state (merged from both pages) ─────────────────────
  const [preferences, setPreferences] = useState({
    voiceAutoPlay: true,
    units: "metric",
    language: "en",
    // Theme
    preset: "soma-indigo",
    appearance: "system",
    radius: "soft",
    font: "modern",
    layout: "sidebar",
    fontSize: "md",
    accentColor: "",
    darkModeBackground: "material" as ThemeSettings["darkModeBackground"],
    customDarkBackground: "#121212",
    savedThemes: [] as ThemeSettings["savedThemes"],
    // Health
    fitnessSuggestions: false,
    medicationReminders: false,
    medicationReminderTime: "08:00",
    dailyCheckInReminder: false,
    dailyCheckInTime: "20:00",
    vitalsThresholds: {
      bloodPressure: { systolic: 140, diastolic: 90 },
      heartRate: { min: 60, max: 100 },
      glucose: { min: 70, max: 140 },
      weight: { changeThreshold: 2 },
    },
    // Notifications
    emailNotifications: {
      dailySummary: false,
      weeklySummary: false,
      abnormalVitals: true,
    },
    pushNotifications: {
      enabled: false,
      sound: true,
      alarmPriorityMedications: false,
    },
    // Privacy
    privacy: {
      dataSharing: false,
      sessionTimeout: 30,
    },
    // Integrations
    integrations: {
      appleHealth: false,
      googleFit: false,
      fitbit: false,
      googleCalendar: false,
      appleCalendar: false,
    },
    // Reports
    reports: {
      defaultTimeRange: 7,
      includeSections: {
        profile: true,
        allergies: true,
        chronicConditions: true,
        medicalHistory: true,
        medications: true,
        vitals: true,
        activitySummary: true,
      },
    },
    // Accessibility
    accessibility: {
      highContrast: false,
      reducedMotion: false,
      screenReader: false,
    },
  });

  // ── Account state ──────────────────────────────────────────────────
  const [email, setEmail] = useState("");
  const [userId, setUserId] = useState("");
  const avatarFileRef = useRef<HTMLInputElement>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // ── Fetch profile ──────────────────────────────────────────────────
  const { data: profileData, isLoading } = useQuery({
    queryKey: ["user-profile-comprehensive"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not authenticated");
      setUserId(u.user.id);
      setEmail(u.user.email || "");

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", u.user.id)
        .maybeSingle();
      if (error) throw error;
      return profile;
    },
  });

  useEffect(() => {
    if (!profileData) return;
    const contacts = Array.isArray(profileData.emergency_contacts)
      ? (profileData.emergency_contacts[0] as EmergencyContact) || {}
      : {};
    const prefs = (profileData.preferences ?? {}) as Record<string, unknown>;

    setIdentity({
      display_name: profileData.display_name || "",
      date_of_birth: profileData.date_of_birth || "",
      sex: profileData.sex || "",
      avatar_url: profileData.avatar_url || "",
      locale: profileData.locale || "en",
      location_region: (prefs.location_region as string) || "",
    });

    setClinical({
      blood_type: profileData.blood_type || "",
      height_cm: profileData.height_cm ? String(profileData.height_cm) : "",
      allergies: Array.isArray(profileData.allergies)
        ? (profileData.allergies as string[]).join(", ")
        : "",
      chronic_conditions: Array.isArray(profileData.chronic_conditions)
        ? (profileData.chronic_conditions as string[]).join(", ")
        : "",
      emergency_name: contacts.name || "",
      emergency_phone: contacts.phone || "",
      emergency_relation: contacts.relation || "",
    });

    setPreferences((prev) => ({
      ...prev,
      ...prefs,
      // Sync: if preferences.language was never set, fall back to profiles.locale
      language: (prefs.language as string) || profileData.locale || "en",
      vitalsThresholds: { ...prev.vitalsThresholds, ...(prefs.vitalsThresholds as object) },
      emailNotifications: { ...prev.emailNotifications, ...(prefs.emailNotifications as object) },
      pushNotifications: { ...prev.pushNotifications, ...(prefs.pushNotifications as object) },
      privacy: { ...prev.privacy, ...(prefs.privacy as object) },
      integrations: { ...prev.integrations, ...(prefs.integrations as object) },
      reports: {
        ...prev.reports,
        ...(prefs.reports as object),
        includeSections: {
          ...prev.reports.includeSections,
          ...((prefs.reports as Record<string, unknown>)?.includeSections as object),
        },
      },
      accessibility: { ...prev.accessibility, ...(prefs.accessibility as object) },
      savedThemes: Array.isArray(prefs.savedThemes)
        ? (prefs.savedThemes as ThemeSettings["savedThemes"])
        : [],
    }));
  }, [profileData]);

  // Sync language with i18n
  useEffect(() => {
    if (preferences.language) i18n.changeLanguage(preferences.language);
  }, [preferences.language]);

  // ── Theme helpers ──────────────────────────────────────────────────
  const themeSettings = useMemo<ThemeSettings>(
    () => ({
      preset: preferences.preset,
      appearance: preferences.appearance as ThemeSettings["appearance"],
      radius: preferences.radius as ThemeSettings["radius"],
      font: preferences.font as ThemeSettings["font"],
      layout: preferences.layout as ThemeSettings["layout"],
      fontSize: preferences.fontSize as ThemeSettings["fontSize"],
      accentColor: preferences.accentColor,
      darkModeBackground: preferences.darkModeBackground,
      customDarkBackground: preferences.customDarkBackground,
      highContrast: preferences.accessibility.highContrast,
      reducedMotion: preferences.accessibility.reducedMotion,
      savedThemes: preferences.savedThemes,
    }),
    [preferences],
  );

  const applyThemeSettings = useCallback(() => {
    applyStoreTheme(themeSettings);
    saveTheme(themeSettings);
  }, [themeSettings]);

  useEffect(() => {
    applyThemeSettings();
  }, [applyThemeSettings]);

  // ── Field updaters ─────────────────────────────────────────────────
  const updateIdentity = (field: string, value: string) => {
    setIdentity((prev) => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleAvatarUpload = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5 MB");
      return;
    }
    setUploadingAvatar(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not authenticated");
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${u.user.id}/avatar.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
      const publicUrl = urlData?.publicUrl;
      if (!publicUrl) throw new Error("Could not get image URL");
      setIdentity((prev) => ({ ...prev, avatar_url: publicUrl }));
      setHasChanges(true);
      toast.success("Photo updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploadingAvatar(false);
    }
  }, []);

  const updateClinical = (field: string, value: string) => {
    setClinical((prev) => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const updatePreference = (field: string, value: unknown) => {
    setPreferences((prev) => {
      if (field.includes(".")) {
        const [parent, child] = field.split(".");
        return {
          ...prev,
          [parent]: {
            ...(prev[parent as keyof typeof prev] as Record<string, unknown>),
            [child]: value,
          },
        };
      }
      return { ...prev, [field]: value } as typeof prev;
    });
    setHasChanges(true);
  };

  const handleThemeChange = useCallback((patch: Partial<ThemeSettings>) => {
    setPreferences((prev) => {
      const next = { ...prev };
      (Object.keys(patch) as (keyof ThemeSettings)[]).forEach((k) => {
        (next as Record<string, unknown>)[k] = patch[k];
      });
      return next;
    });
    setHasChanges(true);
  }, []);

  const handleThemeReset = useCallback(() => {
    setPreferences((prev) => ({
      ...prev,
      preset: DEFAULT_THEME.preset,
      appearance: DEFAULT_THEME.appearance,
      radius: DEFAULT_THEME.radius,
      font: DEFAULT_THEME.font,
      layout: DEFAULT_THEME.layout,
      fontSize: DEFAULT_THEME.fontSize,
      accentColor: DEFAULT_THEME.accentColor,
      darkModeBackground: DEFAULT_THEME.darkModeBackground,
      customDarkBackground: DEFAULT_THEME.customDarkBackground,
    }));
    setHasChanges(true);
  }, []);

  // ── Save mutation ──────────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: async () => {
      // Fetch user ID directly — don't rely on state that may not have loaded yet.
      const { data: u } = await supabase.auth.getUser();
      const uid = u?.user?.id;
      if (!uid) throw new Error("Not authenticated");

      const emergencyContacts = clinical.emergency_name
        ? [
            {
              name: clinical.emergency_name,
              phone: clinical.emergency_phone,
              relation: clinical.emergency_relation,
            },
          ]
        : [];

      const allPrefs = {
        ...preferences,
        location_region: identity.location_region,
        savedThemes: preferences.savedThemes,
      };

      const { error } = await supabase
        .from("profiles")
        .update({
          display_name: identity.display_name,
          date_of_birth: identity.date_of_birth || null,
          sex: identity.sex || null,
          blood_type: clinical.blood_type || null,
          height_cm: clinical.height_cm ? parseFloat(clinical.height_cm) : null,
          avatar_url: identity.avatar_url || null,
          locale: identity.locale,
          allergies: clinical.allergies
            ? clinical.allergies
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean)
            : [],
          chronic_conditions: clinical.chronic_conditions
            ? clinical.chronic_conditions
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean)
            : [],
          emergency_contacts: emergencyContacts,
          preferences: allPrefs,
          updated_at: new Date().toISOString(),
        })
        .eq("id", uid);

      if (error) throw error;

      if (preferences.pushNotifications.enabled) {
        await requestNotificationPermissions();
        await scheduleDailyCheckInNotification(
          preferences.dailyCheckInTime,
          preferences.dailyCheckInReminder,
        );
        const { data: meds } = await supabase
          .from("medications")
          .select("id, name, dose, scheduled_time");
        if (meds) {
          await scheduleMedicationNotifications(
            meds,
            preferences.medicationReminders,
            preferences.pushNotifications.alarmPriorityMedications,
          );
        }
      } else {
        await cancelAllNotifications();
      }
    },
    onSuccess: () => {
      toast.success("Profile saved!");
      setHasChanges(false);
      qc.invalidateQueries({ queryKey: ["user-profile-comprehensive"] });
      applyThemeSettings();
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to save profile");
    },
  });

  if (isLoading) {
    return (
      <AppShell title="Profile" subtitle="Manage your profile and preferences">
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      title={t("profile.title", "Profile & Settings")}
      subtitle={t("profile.subtitle", "Manage your identity, health profile, and preferences")}
      action={
        <Button
          onClick={() => saveMutation.mutate()}
          disabled={!hasChanges || saveMutation.isPending}
          className="soma-gradient soma-glow border-0 text-white"
        >
          {saveMutation.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          {t("profile.save", "Save Changes")}
        </Button>
      }
    >
      <div className="space-y-6">
        {/* Hero card — avatar + quick info */}
        <Card className="border-border bg-card overflow-hidden">
          <div className="h-24 w-full bg-gradient-to-r from-primary/20 via-primary/10 to-success/10" />
          <CardContent className="flex flex-col md:flex-row items-center gap-5 -mt-10 px-6 pb-6">
            <div className="relative">
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-card text-primary font-bold text-3xl overflow-hidden border-4 border-card shadow-lg">
                {identity.avatar_url ? (
                  <img
                    src={identity.avatar_url}
                    alt="Avatar"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <User className="h-10 w-10" />
                )}
              </div>
              <button
                type="button"
                className="absolute bottom-0 right-0 grid h-8 w-8 place-items-center rounded-full bg-primary text-white shadow-md transition hover:bg-primary-strong disabled:opacity-50"
                aria-label="Change photo"
                disabled={uploadingAvatar}
                onClick={() => avatarFileRef.current?.click()}
              >
                {uploadingAvatar ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Camera className="h-4 w-4" />
                )}
              </button>
              <input
                ref={avatarFileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleAvatarUpload(file);
                  e.target.value = "";
                }}
              />
            </div>
            <div className="flex-1 text-center md:text-left">
              <h2 className="font-display text-2xl font-bold">
                {identity.display_name || "SomaCare User"}
              </h2>
              <p className="text-sm text-muted-foreground">{email}</p>
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 pt-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                  <ShieldCheck className="h-3 w-3" /> Verified
                </span>
                {clinical.blood_type && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-3 py-1 text-xs font-medium text-destructive">
                    <Heart className="h-3 w-3" /> Blood: {clinical.blood_type}
                  </span>
                )}
                {identity.locale && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
                    <Globe className="h-3 w-3" /> {identity.locale.toUpperCase()}
                  </span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tab navigation */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="flex h-auto w-full flex-wrap gap-1 p-1 bg-muted/50 rounded-xl mb-6">
            {TABS.map((tab) => (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className="flex-1 flex items-center gap-1.5 justify-center py-2.5 text-[10px] sm:text-xs md:text-sm min-w-0"
              >
                <tab.icon className="h-3.5 w-3.5 shrink-0" />{" "}
                <span className="truncate">{tab.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          {/* ═══════════════════════════════════════════════════════════ */}
          {/*  TAB 1 — Identity & Basics                                */}
          {/* ═══════════════════════════════════════════════════════════ */}
          <TabsContent
            value="identity"
            className="space-y-6 animate-in fade-in-0 slide-in-from-bottom-2"
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-4 w-4 text-primary" /> Personal Information
                </CardTitle>
                <CardDescription>
                  Your basic identity — used across health records and AI.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="display_name">Display Name</Label>
                  <Input
                    id="display_name"
                    value={identity.display_name}
                    onChange={(e) => updateIdentity("display_name", e.target.value)}
                    placeholder="e.g. Kwame Mensah"
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label>Profile Photo</Label>
                  <div className="mt-1.5 flex items-center gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={uploadingAvatar}
                      onClick={() => avatarFileRef.current?.click()}
                    >
                      {uploadingAvatar ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uploading…
                        </>
                      ) : (
                        <>
                          <Camera className="mr-2 h-4 w-4" /> Choose photo
                        </>
                      )}
                    </Button>
                    {identity.avatar_url && (
                      <button
                        type="button"
                        className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                        onClick={() => updateIdentity("avatar_url", "")}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
                <div>
                  <Label htmlFor="date_of_birth">Date of Birth</Label>
                  <Input
                    id="date_of_birth"
                    type="date"
                    value={identity.date_of_birth}
                    onChange={(e) => updateIdentity("date_of_birth", e.target.value)}
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="sex">Sex / Gender</Label>
                  <Select value={identity.sex} onValueChange={(v) => updateIdentity("sex", v)}>
                    <SelectTrigger id="sex" className="mt-1.5">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Male">Male</SelectItem>
                      <SelectItem value="Female">Female</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="language">Language Preference</Label>
                  <Select
                    value={identity.locale}
                    onValueChange={(v) => {
                      // Sync both identity.locale AND preferences.language
                      // so AI chat + voice synthesis use the persisted value
                      updateIdentity("locale", v);
                      updatePreference("language", v);
                    }}
                  >
                    <SelectTrigger id="language" className="mt-1.5">
                      <SelectValue placeholder="Select language" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">English (EN)</SelectItem>
                      <SelectItem value="tw">Twi (Akan)</SelectItem>
                      <SelectItem value="ee">Ewe (EE)</SelectItem>
                      <SelectItem value="ga">Ga (GA)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="location">Location / Region</Label>
                  <Input
                    id="location"
                    value={identity.location_region}
                    onChange={(e) => updateIdentity("location_region", e.target.value)}
                    placeholder="e.g. Greater Accra, Ghana"
                    className="mt-1.5"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ═══════════════════════════════════════════════════════════ */}
          {/*  TAB 2 — Clinical Profile                                 */}
          {/* ═══════════════════════════════════════════════════════════ */}
          <TabsContent
            value="clinical"
            className="space-y-6 animate-in fade-in-0 slide-in-from-bottom-2"
          >
            <div className="grid gap-6 sm:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Heart className="h-4 w-4 text-primary" /> Baselines
                  </CardTitle>
                  <CardDescription>
                    Static measurements for BMI, dosing, and fitness plans.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4">
                  <div>
                    <Label>Blood Type</Label>
                    <Select
                      value={clinical.blood_type}
                      onValueChange={(v) => updateClinical("blood_type", v)}
                    >
                      <SelectTrigger className="mt-1.5">
                        <SelectValue placeholder="Select blood type" />
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
                  <div>
                    <Label htmlFor="height">Height (cm)</Label>
                    <Input
                      id="height"
                      type="number"
                      value={clinical.height_cm}
                      onChange={(e) => updateClinical("height_cm", e.target.value)}
                      placeholder="e.g. 170"
                      className="mt-1.5"
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-warning" /> Allergies
                  </CardTitle>
                  <CardDescription>
                    Comma-separated. Adwoa will flag these in nutrition & medication advice.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <textarea
                    value={clinical.allergies}
                    onChange={(e) => updateClinical("allergies", e.target.value)}
                    placeholder="e.g. Penicillin, Peanuts, Sulfa drugs"
                    rows={3}
                    className="mt-1.5 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary" /> Chronic Conditions
                </CardTitle>
                <CardDescription>
                  Lets Adwoa contextualize vitals: "your BP is high, and you have hypertension
                  noted."
                </CardDescription>
              </CardHeader>
              <CardContent>
                <textarea
                  value={clinical.chronic_conditions}
                  onChange={(e) => updateClinical("chronic_conditions", e.target.value)}
                  placeholder="e.g. Hypertension, Type 2 Diabetes, Asthma"
                  rows={3}
                  className="mt-1.5 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-destructive" /> Emergency Contact
                </CardTitle>
                <CardDescription>Auto-suggested when a serious symptom is logged.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-3">
                <div>
                  <Label htmlFor="emName">Name</Label>
                  <Input
                    id="emName"
                    value={clinical.emergency_name}
                    onChange={(e) => updateClinical("emergency_name", e.target.value)}
                    placeholder="Contact name"
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="emPhone">Phone</Label>
                  <Input
                    id="emPhone"
                    type="tel"
                    value={clinical.emergency_phone}
                    onChange={(e) => updateClinical("emergency_phone", e.target.value)}
                    placeholder="+233..."
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="emRelation">Relationship</Label>
                  <Input
                    id="emRelation"
                    value={clinical.emergency_relation}
                    onChange={(e) => updateClinical("emergency_relation", e.target.value)}
                    placeholder="e.g. Spouse"
                    className="mt-1.5"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ═══════════════════════════════════════════════════════════ */}
          {/*  TAB 3 — Preferences (Appearance + Health)                */}
          {/* ═══════════════════════════════════════════════════════════ */}
          <TabsContent
            value="preferences"
            className="space-y-6 animate-in fade-in-0 slide-in-from-bottom-2"
          >
            {/* Voice & Units */}
            <div className="grid gap-6 sm:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Volume2 className="h-4 w-4 text-primary" /> AI Voice
                  </CardTitle>
                  <CardDescription>Control when Adwoa speaks her replies out loud.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between gap-4">
                    <div className="space-y-0.5">
                      <Label>Speak replies automatically</Label>
                      <p className="text-xs text-muted-foreground">
                        Play Adwoa's voice as soon as she finishes writing.
                      </p>
                    </div>
                    <Switch
                      checked={preferences.voiceAutoPlay}
                      onCheckedChange={(v) => updatePreference("voiceAutoPlay", v)}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Ruler className="h-4 w-4 text-primary" /> Units
                  </CardTitle>
                  <CardDescription>Choose how your health data is displayed.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Select
                    value={preferences.units}
                    onValueChange={(v) => updatePreference("units", v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="metric">Metric (kg, cm, °C)</SelectItem>
                      <SelectItem value="imperial">Imperial (lbs, ft, °F)</SelectItem>
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>
            </div>

            {/* Theme settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Palette className="h-4 w-4 text-primary" /> Appearance
                </CardTitle>
                <CardDescription>Theme, colors, typography, and layout density.</CardDescription>
              </CardHeader>
              <CardContent>
                <ThemeSettingsPanel
                  settings={themeSettings}
                  onChange={handleThemeChange}
                  onReset={handleThemeReset}
                />
              </CardContent>
            </Card>

            {/* Health settings from settings page */}
            <div className="grid gap-6 sm:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Dumbbell className="h-4 w-4 text-primary" /> Fitness Suggestions
                  </CardTitle>
                  <CardDescription>Get personalized workout suggestions.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <Label>Enable Fitness Suggestions</Label>
                    <Switch
                      checked={preferences.fitnessSuggestions}
                      onCheckedChange={(v) => updatePreference("fitnessSuggestions", v)}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Pill className="h-4 w-4 text-primary" /> Medication Reminders
                  </CardTitle>
                  <CardDescription>Set up reminders for your medications.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Enable Medication Reminders</Label>
                    <Switch
                      checked={preferences.medicationReminders}
                      onCheckedChange={(v) => updatePreference("medicationReminders", v)}
                    />
                  </div>
                  {preferences.medicationReminders && (
                    <div>
                      <Label>Default Reminder Time</Label>
                      <Input
                        type="time"
                        value={preferences.medicationReminderTime}
                        onChange={(e) => updatePreference("medicationReminderTime", e.target.value)}
                        className="mt-1.5"
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Vitals Thresholds */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary" /> Vitals Thresholds
                </CardTitle>
                <CardDescription>
                  Customize what counts as "abnormal" for your vitals.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <Label>Blood Pressure (mmHg)</Label>
                  <div className="mt-2 grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm text-muted-foreground">Systolic (High)</Label>
                      <Input
                        type="number"
                        value={preferences.vitalsThresholds.bloodPressure.systolic}
                        onChange={(e) =>
                          updatePreference(
                            "vitalsThresholds.bloodPressure.systolic",
                            parseInt(e.target.value) || 0,
                          )
                        }
                        className="mt-1.5"
                      />
                    </div>
                    <div>
                      <Label className="text-sm text-muted-foreground">Diastolic (High)</Label>
                      <Input
                        type="number"
                        value={preferences.vitalsThresholds.bloodPressure.diastolic}
                        onChange={(e) =>
                          updatePreference(
                            "vitalsThresholds.bloodPressure.diastolic",
                            parseInt(e.target.value) || 0,
                          )
                        }
                        className="mt-1.5"
                      />
                    </div>
                  </div>
                </div>
                <div>
                  <Label>Heart Rate (bpm)</Label>
                  <div className="mt-2 grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm text-muted-foreground">Minimum</Label>
                      <Input
                        type="number"
                        value={preferences.vitalsThresholds.heartRate.min}
                        onChange={(e) =>
                          updatePreference(
                            "vitalsThresholds.heartRate.min",
                            parseInt(e.target.value) || 0,
                          )
                        }
                        className="mt-1.5"
                      />
                    </div>
                    <div>
                      <Label className="text-sm text-muted-foreground">Maximum</Label>
                      <Input
                        type="number"
                        value={preferences.vitalsThresholds.heartRate.max}
                        onChange={(e) =>
                          updatePreference(
                            "vitalsThresholds.heartRate.max",
                            parseInt(e.target.value) || 0,
                          )
                        }
                        className="mt-1.5"
                      />
                    </div>
                  </div>
                </div>
                <div>
                  <Label>Glucose (mg/dL)</Label>
                  <div className="mt-2 grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm text-muted-foreground">Minimum</Label>
                      <Input
                        type="number"
                        value={preferences.vitalsThresholds.glucose.min}
                        onChange={(e) =>
                          updatePreference(
                            "vitalsThresholds.glucose.min",
                            parseInt(e.target.value) || 0,
                          )
                        }
                        className="mt-1.5"
                      />
                    </div>
                    <div>
                      <Label className="text-sm text-muted-foreground">Maximum</Label>
                      <Input
                        type="number"
                        value={preferences.vitalsThresholds.glucose.max}
                        onChange={(e) =>
                          updatePreference(
                            "vitalsThresholds.glucose.max",
                            parseInt(e.target.value) || 0,
                          )
                        }
                        className="mt-1.5"
                      />
                    </div>
                  </div>
                </div>
                <div>
                  <Label>Weight Change Threshold (kg)</Label>
                  <Slider
                    value={[preferences.vitalsThresholds.weight.changeThreshold]}
                    onValueChange={(v) =>
                      updatePreference("vitalsThresholds.weight.changeThreshold", v[0])
                    }
                    min={1}
                    max={10}
                    step={1}
                    className="mt-2"
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    Alert me if my weight changes by{" "}
                    {preferences.vitalsThresholds.weight.changeThreshold} kg or more.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Accessibility */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Accessibility className="h-4 w-4 text-primary" /> Accessibility
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-3">
                <div className="flex items-center justify-between">
                  <Label>High contrast</Label>
                  <Switch
                    checked={preferences.accessibility.highContrast}
                    onCheckedChange={(v) => updatePreference("accessibility.highContrast", v)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Reduced motion</Label>
                  <Switch
                    checked={preferences.accessibility.reducedMotion}
                    onCheckedChange={(v) => updatePreference("accessibility.reducedMotion", v)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Screen reader</Label>
                  <Switch
                    checked={preferences.accessibility.screenReader}
                    onCheckedChange={(v) => updatePreference("accessibility.screenReader", v)}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ═══════════════════════════════════════════════════════════ */}
          {/*  TAB 4 — Notifications                                    */}
          {/* ═══════════════════════════════════════════════════════════ */}
          <TabsContent
            value="notifications"
            className="space-y-6 animate-in fade-in-0 slide-in-from-bottom-2"
          >
            {/* ── Push Notifications ───────────────────────────────── */}
            <Card className="relative overflow-hidden">
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-primary/60 to-success" />
              <CardHeader className="flex flex-row items-start justify-between space-y-0">
                <div className="space-y-1">
                  <CardTitle className="flex items-center gap-2">
                    <Bell className="h-4 w-4 text-primary" /> Push Notifications
                  </CardTitle>
                  <CardDescription>
                    Master push notification settings & device permissions.
                  </CardDescription>
                </div>
                <Badge
                  variant={preferences.pushNotifications.enabled ? "default" : "secondary"}
                  className="mt-1"
                >
                  {preferences.pushNotifications.enabled ? "Active" : "Off"}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-1">
                <div className="flex items-center justify-between rounded-lg bg-muted/40 px-4 py-3">
                  <div className="space-y-0.5">
                    <Label className="text-sm">Enable push notifications</Label>
                    <p className="text-xs text-muted-foreground">Receive alerts on this device.</p>
                  </div>
                  <Switch
                    checked={preferences.pushNotifications.enabled}
                    onCheckedChange={async (v) => {
                      updatePreference("pushNotifications.enabled", v);
                      if (v) {
                        const granted = await requestNotificationPermissions();
                        if (granted) toast.success("Notifications enabled!");
                        else toast.error("Permission not granted");
                      }
                    }}
                  />
                </div>
                {preferences.pushNotifications.enabled && (
                  <>
                    <Separator className="my-2" />
                    <div className="flex items-center justify-between rounded-lg px-4 py-3">
                      <div className="space-y-0.5">
                        <Label className="text-sm">Notification sound</Label>
                        <p className="text-xs text-muted-foreground">
                          Play a sound with each alert.
                        </p>
                      </div>
                      <Switch
                        checked={preferences.pushNotifications.sound}
                        onCheckedChange={(v) => updatePreference("pushNotifications.sound", v)}
                      />
                    </div>
                    <Separator className="my-2" />
                    <div className="flex items-center justify-between rounded-lg px-4 py-3">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <Label className="text-sm">Alarm priority for meds</Label>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent>
                                Makes medication reminders high importance with a persistent alarm
                                sound.
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          High importance with persistent alarm sound.
                        </p>
                      </div>
                      <Switch
                        checked={preferences.pushNotifications.alarmPriorityMedications}
                        onCheckedChange={(v) =>
                          updatePreference("pushNotifications.alarmPriorityMedications", v)
                        }
                      />
                    </div>
                  </>
                )}
              </CardContent>
              {preferences.pushNotifications.enabled && (
                <CardFooter className="border-t px-6 py-3">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={async () => {
                      const granted = await requestNotificationPermissions();
                      if (granted) toast.success("Permissions active!");
                      else toast.error("Permission denied.");
                    }}
                  >
                    Re-check Device Permissions
                  </Button>
                </CardFooter>
              )}
            </Card>

            {/* ── Reminders ────────────────────────────────────────── */}
            <div className="grid gap-6 sm:grid-cols-2">
              <Card className="relative overflow-hidden">
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-500 to-orange-500" />
                <CardHeader className="flex flex-row items-start justify-between space-y-0">
                  <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-amber-600 dark:text-amber-400" /> Daily
                      Check-in
                    </CardTitle>
                    <CardDescription>A gentle nudge to log your vitals each day.</CardDescription>
                  </div>
                  <Badge
                    variant={preferences.dailyCheckInReminder ? "default" : "secondary"}
                    className="mt-1"
                  >
                    {preferences.dailyCheckInReminder ? "On" : "Off"}
                  </Badge>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between rounded-lg bg-muted/40 px-4 py-3">
                    <Label className="text-sm">Enable daily check-in</Label>
                    <Switch
                      checked={preferences.dailyCheckInReminder}
                      onCheckedChange={(v) => updatePreference("dailyCheckInReminder", v)}
                    />
                  </div>
                  {preferences.dailyCheckInReminder && (
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Reminder time</Label>
                      <Input
                        type="time"
                        value={preferences.dailyCheckInTime}
                        onChange={(e) => updatePreference("dailyCheckInTime", e.target.value)}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="relative overflow-hidden">
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-violet-500 to-purple-600" />
                <CardHeader className="flex flex-row items-start justify-between space-y-0">
                  <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2">
                      <Pill className="h-4 w-4 text-violet-600 dark:text-violet-400" /> Medication
                      Reminders
                    </CardTitle>
                    <CardDescription>Never miss a dose with timely alerts.</CardDescription>
                  </div>
                  <Badge
                    variant={preferences.medicationReminders ? "default" : "secondary"}
                    className="mt-1"
                  >
                    {preferences.medicationReminders ? "On" : "Off"}
                  </Badge>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between rounded-lg bg-muted/40 px-4 py-3">
                    <Label className="text-sm">Enable medication reminders</Label>
                    <Switch
                      checked={preferences.medicationReminders}
                      onCheckedChange={(v) => updatePreference("medicationReminders", v)}
                    />
                  </div>
                  {preferences.medicationReminders && (
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Default reminder time</Label>
                      <Input
                        type="time"
                        value={preferences.medicationReminderTime}
                        onChange={(e) => updatePreference("medicationReminderTime", e.target.value)}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* ── Email Notifications ───────────────────────────────── */}
            <Card className="relative overflow-hidden">
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-sky-500 to-cyan-500" />
              <CardHeader className="flex flex-row items-start justify-between space-y-0">
                <div className="space-y-1">
                  <CardTitle className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-sky-600 dark:text-sky-400" /> Email Notifications
                  </CardTitle>
                  <CardDescription>Choose which emails you receive.</CardDescription>
                </div>
                <Badge
                  variant={
                    preferences.emailNotifications.dailySummary ||
                    preferences.emailNotifications.weeklySummary ||
                    preferences.emailNotifications.abnormalVitals
                      ? "default"
                      : "secondary"
                  }
                  className="mt-1"
                >
                  {preferences.emailNotifications.dailySummary ||
                  preferences.emailNotifications.weeklySummary ||
                  preferences.emailNotifications.abnormalVitals
                    ? "Active"
                    : "Off"}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-1">
                {[
                  {
                    key: "dailySummary" as const,
                    label: "Daily Summary",
                    desc: "A recap of your day's health data.",
                  },
                  {
                    key: "weeklySummary" as const,
                    label: "Weekly Summary",
                    desc: "A weekly digest of your health trends.",
                  },
                  {
                    key: "abnormalVitals" as const,
                    label: "Abnormal Vitals Alerts",
                    desc: "Instant alert when a reading is out of range.",
                  },
                ].map((item, i) => (
                  <div key={item.key} className="space-y-0">
                    {i > 0 && <Separator className="my-2" />}
                    <div className="flex items-center justify-between rounded-lg px-4 py-3 hover:bg-muted/30 transition-colors">
                      <div className="space-y-0.5">
                        <Label className="text-sm">{item.label}</Label>
                        <p className="text-xs text-muted-foreground">{item.desc}</p>
                      </div>
                      <Switch
                        checked={preferences.emailNotifications[item.key]}
                        onCheckedChange={(v) =>
                          updatePreference(`emailNotifications.${item.key}`, v)
                        }
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ═══════════════════════════════════════════════════════════ */}
          {/*  TAB 5 — Privacy & Security                               */}
          {/* ═══════════════════════════════════════════════════════════ */}
          <TabsContent
            value="privacy"
            className="space-y-6 animate-in fade-in-0 slide-in-from-bottom-2"
          >
            <div className="grid gap-6 sm:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-primary" /> Data Sharing
                  </CardTitle>
                  <CardDescription>
                    Help improve SomaCare by sharing anonymized data.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <Label>Share Anonymized Data for Research</Label>
                    <Switch
                      checked={preferences.privacy.dataSharing}
                      onCheckedChange={(v) => updatePreference("privacy.dataSharing", v)}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Lock className="h-4 w-4 text-primary" /> Session Timeout
                  </CardTitle>
                  <CardDescription>Automatically log out after inactivity.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Label>Timeout Duration (minutes)</Label>
                  <Select
                    value={preferences.privacy.sessionTimeout.toString()}
                    onValueChange={(v) => updatePreference("privacy.sessionTimeout", parseInt(v))}
                  >
                    <SelectTrigger className="mt-1.5">
                      <SelectValue placeholder="Select timeout" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5 minutes</SelectItem>
                      <SelectItem value="15">15 minutes</SelectItem>
                      <SelectItem value="30">30 minutes</SelectItem>
                      <SelectItem value="60">60 minutes</SelectItem>
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-primary" /> Two-Factor Authentication
                </CardTitle>
                <CardDescription>Add an extra layer of security to your account.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <Label>Enable Two-Factor Authentication</Label>
                  <Switch disabled />
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  Two-factor authentication is not yet available. We're working on adding this
                  feature soon.
                </p>
              </CardContent>
            </Card>

            {/* Reports & Exports */}
            <div className="grid gap-6 sm:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" /> Report Settings
                  </CardTitle>
                  <CardDescription>Customize your health reports.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Default Time Range (days)</Label>
                    <Select
                      value={preferences.reports.defaultTimeRange.toString()}
                      onValueChange={(v) =>
                        updatePreference("reports.defaultTimeRange", parseInt(v))
                      }
                    >
                      <SelectTrigger className="mt-1.5">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="7">7 days</SelectItem>
                        <SelectItem value="14">14 days</SelectItem>
                        <SelectItem value="30">30 days</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Include in Reports</Label>
                    <div className="space-y-2 mt-2">
                      {Object.entries(preferences.reports.includeSections).map(([key, value]) => (
                        <div key={key} className="flex items-center justify-between">
                          <Label className="capitalize text-sm">
                            {key.replace(/([A-Z])/g, " $1")}
                          </Label>
                          <Switch
                            checked={value}
                            onCheckedChange={(v) =>
                              updatePreference(`reports.includeSections.${key}`, v)
                            }
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Download className="h-4 w-4 text-primary" /> Data Export
                  </CardTitle>
                  <CardDescription>Export your health data.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button variant="outline" className="w-full" disabled>
                    <Download className="mr-2 h-4 w-4" /> Export Data as CSV
                  </Button>
                  <Button variant="outline" className="w-full" disabled>
                    <Download className="mr-2 h-4 w-4" /> Export Data as JSON
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Data export is not yet available. We're working on adding this feature soon.
                  </p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ═══════════════════════════════════════════════════════════ */}
          {/*  TAB 6 — Integrations                                     */}
          {/* ═══════════════════════════════════════════════════════════ */}
          <TabsContent
            value="integrations"
            className="space-y-6 animate-in fade-in-0 slide-in-from-bottom-2"
          >
            <div className="grid gap-6 sm:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-emerald-600" /> Connected Devices
                  </CardTitle>
                  <CardDescription>Sync with your wearable devices.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Apple Health</Label>
                    <Switch
                      checked={preferences.integrations.appleHealth}
                      onCheckedChange={(v) => updatePreference("integrations.appleHealth", v)}
                      disabled
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>Google Fit</Label>
                    <Switch
                      checked={preferences.integrations.googleFit}
                      onCheckedChange={(v) => updatePreference("integrations.googleFit", v)}
                      disabled
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>Fitbit</Label>
                    <Switch
                      checked={preferences.integrations.fitbit}
                      onCheckedChange={(v) => updatePreference("integrations.fitbit", v)}
                      disabled
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Device sync is not yet available. Coming soon.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-emerald-600" /> Calendar Sync
                  </CardTitle>
                  <CardDescription>
                    Sync your health appointments with your calendar.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Google Calendar</Label>
                    <Switch
                      checked={preferences.integrations.googleCalendar}
                      onCheckedChange={(v) => updatePreference("integrations.googleCalendar", v)}
                      disabled
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>Apple Calendar</Label>
                    <Switch
                      checked={preferences.integrations.appleCalendar}
                      onCheckedChange={(v) => updatePreference("integrations.appleCalendar", v)}
                      disabled
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Calendar sync is not yet available. Coming soon.
                  </p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ═══════════════════════════════════════════════════════════ */}
          {/*  TAB 7 — Account & Security                               */}
          {/* ═══════════════════════════════════════════════════════════ */}
          <TabsContent
            value="account"
            className="space-y-6 animate-in fade-in-0 slide-in-from-bottom-2"
          >
            <div className="grid gap-6 sm:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Lock className="h-4 w-4 text-primary" /> Account Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Email</Label>
                    <Input value={email} disabled className="mt-1.5" />
                  </div>
                  <div>
                    <Label>Phone Number</Label>
                    <Input placeholder="Your phone number" disabled className="mt-1.5" />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Email and password are managed through your sign-in provider.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Moon className="h-4 w-4 text-primary" /> Data & Privacy
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button variant="outline" className="w-full" disabled>
                    <Download className="mr-2 h-4 w-4" /> Export My Health Data
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Download all your health records, vitals, and AI conversations.
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Danger zone */}
            <Card className="border-destructive/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="h-4 w-4" /> Danger Zone
                </CardTitle>
                <CardDescription>
                  Permanently delete your account and all data. This cannot be undone.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="destructive" disabled>
                  <Trash2 className="mr-2 h-4 w-4" /> Delete Account
                </Button>
                <p className="text-xs text-muted-foreground mt-2">
                  Account deletion is not yet available. Please contact support if needed.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
