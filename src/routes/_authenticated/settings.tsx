"use client";

import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import {
  Loader2,
  Palette,
  Heart,
  Bell,
  Shield,
  User,
  Link,
  FileText,
  Accessibility,
  Save,
  Globe,
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

// Units of measurement
const UNIT_OPTIONS = [
  { value: "metric", label: "Metric (kg, cm, °C)" },
  { value: "imperial", label: "Imperial (lbs, ft, °F)" },
];

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState("appearance");
  const [hasChanges, setHasChanges] = useState(false);

  // User preferences state
  const [preferences, setPreferences] = useState({
    language: "en",
    theme: "system",
    preset: "soma-indigo",
    darkModeBackground: "material", // material, pure-black, custom
    customDarkBackground: "#121212",
    fontSize: "md",
    accentColor: "", // hex accent override; empty = follow preset
    savedThemes: [] as ThemeSettings["savedThemes"],
    radius: "soft",
    font: "modern",
    layout: "sidebar",
    appearance: "system",
    units: "metric",
    fitnessSuggestions: false,
    medicationReminders: false,
    medicationReminderTime: "08:00",
    dailyCheckInReminder: false,
    dailyCheckInTime: "20:00",
    vitalsThresholds: {
      bloodPressure: { systolic: 140, diastolic: 90 },
      heartRate: { min: 60, max: 100 },
      glucose: { min: 70, max: 140 },
      weight: { changeThreshold: 2 }, // kg
    },
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
    privacy: {
      dataSharing: false,
      sessionTimeout: 30, // minutes
    },
    integrations: {
      appleHealth: false,
      googleFit: false,
      fitbit: false,
      googleCalendar: false,
      appleCalendar: false,
    },
    reports: {
      defaultTimeRange: 7, // days
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
    accessibility: {
      highContrast: false,
      reducedMotion: false,
      screenReader: false,
    },
  });

  // Fetch user preferences
  const { data: userData } = useQuery({
    queryKey: ["user-preferences"],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("preferences")
        .eq("id", user.id)
        .maybeSingle();

      return (profile?.preferences ?? {}) as Partial<typeof preferences> & Record<string, unknown>;
    },
  });

  // Initialize preferences from fetched data
  useEffect(() => {
    if (userData) {
      setPreferences((prev) => ({
        ...prev,
        ...userData,
        // Ensure nested objects are merged correctly
        vitalsThresholds: { ...prev.vitalsThresholds, ...userData.vitalsThresholds },
        emailNotifications: { ...prev.emailNotifications, ...userData.emailNotifications },
        pushNotifications: { ...prev.pushNotifications, ...userData.pushNotifications },
        privacy: { ...prev.privacy, ...userData.privacy },
        integrations: { ...prev.integrations, ...userData.integrations },
        reports: { ...prev.reports, ...userData.reports },
        accessibility: { ...prev.accessibility, ...userData.accessibility },
      }));
    }
  }, [userData]);

  // Sync language with i18n
  useEffect(() => {
    if (preferences.language) {
      i18n.changeLanguage(preferences.language);
    }
  }, [preferences.language]);

  // Build the ThemeSettings object the shared theme-store consumes.
  const themeSettings = useMemo<ThemeSettings>(
    () => ({
      preset: preferences.preset,
      appearance: preferences.appearance as ThemeSettings["appearance"],
      radius: preferences.radius as ThemeSettings["radius"],
      font: preferences.font as ThemeSettings["font"],
      layout: preferences.layout as ThemeSettings["layout"],
      fontSize: preferences.fontSize as ThemeSettings["fontSize"],
      accentColor: preferences.accentColor,
      darkModeBackground: preferences.darkModeBackground as ThemeSettings["darkModeBackground"],
      customDarkBackground: preferences.customDarkBackground,
      highContrast: preferences.accessibility.highContrast,
      reducedMotion: preferences.accessibility.reducedMotion,
      savedThemes: preferences.savedThemes,
    }),
    [
      preferences.preset,
      preferences.appearance,
      preferences.radius,
      preferences.font,
      preferences.layout,
      preferences.fontSize,
      preferences.accentColor,
      preferences.darkModeBackground,
      preferences.customDarkBackground,
      preferences.accessibility.highContrast,
      preferences.accessibility.reducedMotion,
      preferences.savedThemes,
    ],
  );

  // Apply the theme and cache it to the device whenever it changes.
  const applyThemeSettings = useCallback(() => {
    applyStoreTheme(themeSettings);
    saveTheme(themeSettings);
  }, [themeSettings]);

  // Apply theme when preferences change
  useEffect(() => {
    applyThemeSettings();
  }, [applyThemeSettings]);

  // Mirror the shared panel's changes into the preferences state.
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

  // Update field handler
  const updateField = (field: string, value: string | number | boolean) => {
    setPreferences((prev) => {
      // Handle nested fields (e.g., "emailNotifications.dailySummary")
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
      return { ...prev, [field]: value };
    });
    setHasChanges(true);
  };

  // Save preferences
  const saveMutation = useMutation({
    mutationFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase.from("profiles").update({ preferences }).eq("id", user.id);

      if (error) throw error;

      if (preferences.pushNotifications.enabled) {
        await requestNotificationPermissions();
        await scheduleDailyCheckInNotification(
          preferences.dailyCheckInTime || "20:00",
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
      toast.success("Settings saved!");
      setHasChanges(false);
      qc.invalidateQueries({ queryKey: ["user-preferences"] });
      // Apply theme changes immediately
      applyThemeSettings();
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to save settings");
    },
  });

  const handleSave = () => saveMutation.mutate();

  return (
    <AppShell
      title={t("settings.title", "Settings")}
      subtitle={t("settings.subtitle", "Customize your SomaCare experience")}
      action={
        <Button
          onClick={handleSave}
          disabled={!hasChanges || saveMutation.isPending}
          className="soma-gradient soma-glow border-0 text-white"
        >
          {saveMutation.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          {t("settings.save", "Save Changes")}
        </Button>
      }
    >
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="flex h-auto w-full flex-wrap gap-1 p-1 bg-muted/50 rounded-lg mb-6">
          <TabsTrigger
            value="appearance"
            className="flex-1 flex items-center gap-2 justify-center py-2"
          >
            <Palette className="h-4 w-4" /> {t("settings.appearance", "Appearance")}
          </TabsTrigger>
          <TabsTrigger
            value="health"
            className="flex-1 flex items-center gap-2 justify-center py-2"
          >
            <Heart className="h-4 w-4" /> {t("settings.health", "Health")}
          </TabsTrigger>
          <TabsTrigger
            value="notifications"
            className="flex-1 flex items-center gap-2 justify-center py-2"
          >
            <Bell className="h-4 w-4" /> {t("settings.notifications", "Notifications")}
          </TabsTrigger>
          <TabsTrigger
            value="privacy"
            className="flex-1 flex items-center gap-2 justify-center py-2"
          >
            <Shield className="h-4 w-4" /> {t("settings.privacy", "Privacy & Security")}
          </TabsTrigger>
          <TabsTrigger
            value="account"
            className="flex-1 flex items-center gap-2 justify-center py-2"
          >
            <User className="h-4 w-4" /> {t("settings.account", "Account")}
          </TabsTrigger>
          <TabsTrigger
            value="integrations"
            className="flex-1 flex items-center gap-2 justify-center py-2 relative"
          >
            <Link className="h-4 w-4 text-emerald-600" />{" "}
            {t("settings.integrations", "Integrations")}
            <span className="absolute -top-1 -right-1 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
          </TabsTrigger>
          <TabsTrigger
            value="reports"
            className="flex-1 flex items-center gap-2 justify-center py-2"
          >
            <FileText className="h-4 w-4" /> {t("settings.reports", "Reports & Exports")}
          </TabsTrigger>
          <TabsTrigger
            value="accessibility"
            className="flex-1 flex items-center gap-2 justify-center py-2"
          >
            <Accessibility className="h-4 w-4" /> {t("settings.accessibility", "Accessibility")}
          </TabsTrigger>
        </TabsList>

        {/* Appearance Tab */}
        <TabsContent value="appearance" className="space-y-6 p-4">
          {/* Language Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-4 w-4" />
                {t("settings.language", "Language")}
              </CardTitle>
              <CardDescription>
                {t("settings.languageDescription", "Select your preferred language for the app.")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Select
                value={preferences.language || "en"}
                onValueChange={(v) => updateField("language", v)}
              >
                <SelectTrigger id="language" className="mt-1.5">
                  <SelectValue placeholder={t("settings.language", "Select language")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English (EN)</SelectItem>
                  <SelectItem value="tw">Twi (Akan) — Beta</SelectItem>
                  <SelectItem value="ee">Ewe (EE) — Coming Soon</SelectItem>
                  <SelectItem value="ga">Ga (GA) — Coming Soon</SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          <ThemeSettingsPanel
            settings={themeSettings}
            onChange={handleThemeChange}
            onReset={handleThemeReset}
          />
        </TabsContent>

        {/* Health Tab */}
        <TabsContent value="health" className="space-y-6 p-4">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>{t("settings.units", "Units of Measurement")}</CardTitle>
                <CardDescription>
                  {t("settings.unitsDescription", "Choose how your health data is displayed.")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="units">
                    {t("settings.measurementSystem", "Measurement System")}
                  </Label>
                  <Select value={preferences.units} onValueChange={(v) => updateField("units", v)}>
                    <SelectTrigger id="units" className="mt-1.5">
                      <SelectValue placeholder="Select units" />
                    </SelectTrigger>
                    <SelectContent>
                      {UNIT_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t("settings.fitnessSuggestions", "Fitness Suggestions")}</CardTitle>
                <CardDescription>
                  {t(
                    "settings.fitnessSuggestionsDescription",
                    "Get personalized workout suggestions.",
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="fitnessSuggestions">
                    {t("settings.enableFitnessSuggestions", "Enable Fitness Suggestions")}
                  </Label>
                  <Switch
                    id="fitnessSuggestions"
                    checked={preferences.fitnessSuggestions}
                    onCheckedChange={(v) => updateField("fitnessSuggestions", v)}
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>{t("settings.medicationReminders", "Medication Reminders")}</CardTitle>
                <CardDescription>
                  {t(
                    "settings.medicationRemindersDescription",
                    "Set up reminders for your medications.",
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="medicationReminders">
                    {t("settings.enableMedicationReminders", "Enable Medication Reminders")}
                  </Label>
                  <Switch
                    id="medicationReminders"
                    checked={preferences.medicationReminders}
                    onCheckedChange={(v) => updateField("medicationReminders", v)}
                  />
                </div>
                {preferences.medicationReminders && (
                  <div>
                    <Label htmlFor="medicationReminderTime">
                      {t("settings.defaultReminderTime", "Default Reminder Time")}
                    </Label>
                    <Input
                      id="medicationReminderTime"
                      type="time"
                      value={preferences.medicationReminderTime}
                      onChange={(e) => updateField("medicationReminderTime", e.target.value)}
                      className="mt-1.5"
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>{t("settings.vitalsThresholds", "Vitals Thresholds")}</CardTitle>
                <CardDescription>
                  {t(
                    "settings.vitalsThresholdsDescription",
                    'Customize what counts as "abnormal" for your vitals.',
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <Label>{t("settings.bpMmHg", "Blood Pressure (mmHg)")}</Label>
                  <div className="mt-2 grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="bpSystolic" className="text-sm text-muted-foreground">
                        {t("settings.bpSystolic", "Systolic (High)")}
                      </Label>
                      <Input
                        id="bpSystolic"
                        type="number"
                        value={preferences.vitalsThresholds.bloodPressure.systolic}
                        onChange={(e) =>
                          updateField(
                            "vitalsThresholds.bloodPressure.systolic",
                            parseInt(e.target.value) || 0,
                          )
                        }
                        className="mt-1.5"
                      />
                    </div>
                    <div>
                      <Label htmlFor="bpDiastolic" className="text-sm text-muted-foreground">
                        {t("settings.bpDiastolic", "Diastolic (High)")}
                      </Label>
                      <Input
                        id="bpDiastolic"
                        type="number"
                        value={preferences.vitalsThresholds.bloodPressure.diastolic}
                        onChange={(e) =>
                          updateField(
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
                  <Label>{t("settings.hrBpm", "Heart Rate (bpm)")}</Label>
                  <div className="mt-2 grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="hrMin" className="text-sm text-muted-foreground">
                        {t("settings.hrMin", "Minimum")}
                      </Label>
                      <Input
                        id="hrMin"
                        type="number"
                        value={preferences.vitalsThresholds.heartRate.min}
                        onChange={(e) =>
                          updateField(
                            "vitalsThresholds.heartRate.min",
                            parseInt(e.target.value) || 0,
                          )
                        }
                        className="mt-1.5"
                      />
                    </div>
                    <div>
                      <Label htmlFor="hrMax" className="text-sm text-muted-foreground">
                        {t("settings.hrMax", "Maximum")}
                      </Label>
                      <Input
                        id="hrMax"
                        type="number"
                        value={preferences.vitalsThresholds.heartRate.max}
                        onChange={(e) =>
                          updateField(
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
                  <Label>{t("settings.glucoseMgDl", "Glucose (mg/dL)")}</Label>
                  <div className="mt-2 grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="glucoseMin" className="text-sm text-muted-foreground">
                        {t("settings.glucoseMin", "Minimum")}
                      </Label>
                      <Input
                        id="glucoseMin"
                        type="number"
                        value={preferences.vitalsThresholds.glucose.min}
                        onChange={(e) =>
                          updateField("vitalsThresholds.glucose.min", parseInt(e.target.value) || 0)
                        }
                        className="mt-1.5"
                      />
                    </div>
                    <div>
                      <Label htmlFor="glucoseMax" className="text-sm text-muted-foreground">
                        {t("settings.glucoseMax", "Maximum")}
                      </Label>
                      <Input
                        id="glucoseMax"
                        type="number"
                        value={preferences.vitalsThresholds.glucose.max}
                        onChange={(e) =>
                          updateField("vitalsThresholds.glucose.max", parseInt(e.target.value) || 0)
                        }
                        className="mt-1.5"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <Label>{t("settings.weightThreshold", "Weight Change Threshold (kg)")}</Label>
                  <Slider
                    value={[preferences.vitalsThresholds.weight.changeThreshold]}
                    onValueChange={(v) =>
                      updateField("vitalsThresholds.weight.changeThreshold", v[0])
                    }
                    min={1}
                    max={10}
                    step={1}
                    className="mt-2"
                  />
                  <div className="text-sm text-muted-foreground mt-1">
                    {t(
                      "settings.weightThresholdDescription",
                      "Alert me if my weight changes by {{value}} kg or more.",
                      { value: preferences.vitalsThresholds.weight.changeThreshold },
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications" className="space-y-6 p-4">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>{t("settings.emailNotifications", "Email Notifications")}</CardTitle>
                <CardDescription>
                  {t("settings.emailNotificationsDescription", "Choose which emails you receive.")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="dailySummary">
                    {t("settings.dailySummary", "Daily Summary")}
                  </Label>
                  <Switch
                    id="dailySummary"
                    checked={preferences.emailNotifications.dailySummary}
                    onCheckedChange={(v) => updateField("emailNotifications.dailySummary", v)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="weeklySummary">
                    {t("settings.weeklySummary", "Weekly Summary")}
                  </Label>
                  <Switch
                    id="weeklySummary"
                    checked={preferences.emailNotifications.weeklySummary}
                    onCheckedChange={(v) => updateField("emailNotifications.weeklySummary", v)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="abnormalVitals">
                    {t("settings.abnormalVitals", "Abnormal Vitals Alerts")}
                  </Label>
                  <Switch
                    id="abnormalVitals"
                    checked={preferences.emailNotifications.abnormalVitals}
                    onCheckedChange={(v) => updateField("emailNotifications.abnormalVitals", v)}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t("settings.pushNotifications", "Push Notifications")}</CardTitle>
                <CardDescription>
                  {t(
                    "settings.pushNotificationsDescription",
                    "Master push notification settings & device permissions (Android 13+).",
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="pushEnabled">
                    {t("settings.enablePush", "Enable Push Notifications")}
                  </Label>
                  <Switch
                    id="pushEnabled"
                    checked={preferences.pushNotifications.enabled}
                    onCheckedChange={async (v) => {
                      updateField("pushNotifications.enabled", v);
                      if (v) {
                        const granted = await requestNotificationPermissions();
                        if (granted) {
                          toast.success("Notification permissions granted!");
                        } else {
                          toast.error("Notification permissions were not granted.");
                        }
                      }
                    }}
                  />
                </div>
                {preferences.pushNotifications.enabled && (
                  <>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="pushSound">
                        {t("settings.pushSound", "Notification Sound")}
                      </Label>
                      <Switch
                        id="pushSound"
                        checked={preferences.pushNotifications.sound}
                        onCheckedChange={(v) => updateField("pushNotifications.sound", v)}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="alarmPriorityMedications">
                          {t("settings.alarmPriorityMedications", "Alarm Priority for Medications")}
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          {t(
                            "settings.alarmPriorityMedicationsDescription",
                            "Make medication reminders high importance with persistent alarm sound.",
                          )}
                        </p>
                      </div>
                      <Switch
                        id="alarmPriorityMedications"
                        checked={preferences.pushNotifications.alarmPriorityMedications}
                        onCheckedChange={(v) =>
                          updateField("pushNotifications.alarmPriorityMedications", v)
                        }
                      />
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full mt-2"
                      onClick={async () => {
                        const granted = await requestNotificationPermissions();
                        if (granted) {
                          toast.success("Notification permissions active!");
                        } else {
                          toast.error("Permission denied or unavailable on this device.");
                        }
                      }}
                    >
                      Request / Check Permissions
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>
                  {t("settings.dailyCheckInReminder", "Daily Health Check-in Reminder")}
                </CardTitle>
                <CardDescription>
                  {t(
                    "settings.dailyCheckInReminderDescription",
                    "Get reminded daily to record your vitals and check-in.",
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="dailyCheckInReminder">Enable Check-in Reminder</Label>
                  <Switch
                    id="dailyCheckInReminder"
                    checked={preferences.dailyCheckInReminder}
                    onCheckedChange={(v) => updateField("dailyCheckInReminder", v)}
                  />
                </div>
                {preferences.dailyCheckInReminder && (
                  <div>
                    <Label htmlFor="dailyCheckInTime">Check-in Time</Label>
                    <Input
                      id="dailyCheckInTime"
                      type="time"
                      value={preferences.dailyCheckInTime}
                      onChange={(e) => updateField("dailyCheckInTime", e.target.value)}
                      className="mt-1.5"
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>{t("settings.medicationReminders", "Medication Reminders")}</CardTitle>
                <CardDescription>
                  {t(
                    "settings.medicationRemindersDescription",
                    "Get timely reminders for scheduled medications.",
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="medicationReminders">Enable Medication Reminders</Label>
                  <Switch
                    id="medicationReminders"
                    checked={preferences.medicationReminders}
                    onCheckedChange={(v) => updateField("medicationReminders", v)}
                  />
                </div>
                {preferences.medicationReminders && (
                  <div>
                    <Label htmlFor="medicationReminderTime">Default Reminder Time</Label>
                    <Input
                      id="medicationReminderTime"
                      type="time"
                      value={preferences.medicationReminderTime}
                      onChange={(e) => updateField("medicationReminderTime", e.target.value)}
                      className="mt-1.5"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Individual medication scheduled times are used if configured.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Privacy & Security Tab */}
        <TabsContent value="privacy" className="space-y-6 p-4">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>{t("settings.privacyDataSharing", "Data Sharing")}</CardTitle>
                <CardDescription>
                  {t(
                    "settings.privacyDataSharingDescription",
                    "Help improve SomaCare by sharing anonymized data.",
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="dataSharing">
                    {t("settings.privacyDataSharingEnabled", "Share Anonymized Data for Research")}
                  </Label>
                  <Switch
                    id="dataSharing"
                    checked={preferences.privacy.dataSharing}
                    onCheckedChange={(v) => updateField("privacy.dataSharing", v)}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t("settings.sessionTimeout", "Session Timeout")}</CardTitle>
                <CardDescription>
                  {t(
                    "settings.sessionTimeoutDescription",
                    "Automatically log out after inactivity.",
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="sessionTimeout">
                    {t("settings.sessionTimeoutDuration", "Timeout Duration (minutes)")}
                  </Label>
                  <Select
                    value={preferences.privacy.sessionTimeout.toString()}
                    onValueChange={(v) => updateField("privacy.sessionTimeout", parseInt(v))}
                  >
                    <SelectTrigger id="sessionTimeout" className="mt-1.5">
                      <SelectValue placeholder="Select timeout" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5 minutes</SelectItem>
                      <SelectItem value="15">15 minutes</SelectItem>
                      <SelectItem value="30">30 minutes</SelectItem>
                      <SelectItem value="60">60 minutes</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>{t("settings.twoFactor", "Two-Factor Authentication")}</CardTitle>
                <CardDescription>
                  {t(
                    "settings.twoFactorDescription",
                    "Add an extra layer of security to your account.",
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="twoFactor">
                    {t("settings.twoFactorEnabled", "Enable Two-Factor Authentication")}
                  </Label>
                  <Switch id="twoFactor" disabled />
                </div>
                <p className="text-sm text-muted-foreground">
                  {t(
                    "settings.twoFactorUnavailable",
                    "Two-factor authentication is not yet available. We're working on adding this feature soon.",
                  )}
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Account Tab */}
        <TabsContent value="account" className="space-y-6 p-4">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>{t("settings.profileInformation", "Profile Information")}</CardTitle>
                <CardDescription>
                  {t("settings.profileInformationDescription", "Update your personal details.")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="name">{t("settings.name", "Name")}</Label>
                  <Input id="name" placeholder="Your name" className="mt-1.5" disabled />
                </div>
                <div>
                  <Label htmlFor="email">{t("settings.email", "Email")}</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="Your email"
                    className="mt-1.5"
                    disabled
                  />
                </div>
                <div>
                  <Label htmlFor="phone">{t("settings.phone", "Phone Number")}</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="Your phone number"
                    className="mt-1.5"
                    disabled
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t("settings.deleteAccount", "Delete Account")}</CardTitle>
                <CardDescription>
                  {t(
                    "settings.deleteAccountDescription",
                    "Permanently delete your account and all data.",
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button variant="destructive" disabled>
                  {t("settings.deleteAccount", "Delete Account")}
                </Button>
                <p className="text-sm text-muted-foreground">
                  {t(
                    "settings.deleteAccountUnavailable",
                    "Account deletion is not yet available. Please contact support if you need to delete your account.",
                  )}
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Integrations Tab */}
        <TabsContent value="integrations" className="space-y-6 p-4">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>{t("settings.connectedDevices", "Connected Devices")}</CardTitle>
                <CardDescription>
                  {t("settings.connectedDevicesDescription", "Sync with your wearable devices.")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="appleHealth">{t("settings.appleHealth", "Apple Health")}</Label>
                  <Switch
                    id="appleHealth"
                    checked={preferences.integrations.appleHealth}
                    onCheckedChange={(v) => updateField("integrations.appleHealth", v)}
                    disabled
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="googleFit">{t("settings.googleFit", "Google Fit")}</Label>
                  <Switch
                    id="googleFit"
                    checked={preferences.integrations.googleFit}
                    onCheckedChange={(v) => updateField("integrations.googleFit", v)}
                    disabled
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="fitbit">{t("settings.fitbit", "Fitbit")}</Label>
                  <Switch
                    id="fitbit"
                    checked={preferences.integrations.fitbit}
                    onCheckedChange={(v) => updateField("integrations.fitbit", v)}
                    disabled
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  {t(
                    "settings.deviceSyncUnavailable",
                    "Device sync is not yet available. We're working on adding these integrations soon.",
                  )}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t("settings.calendarSync", "Calendar Sync")}</CardTitle>
                <CardDescription>
                  {t(
                    "settings.calendarSyncDescription",
                    "Sync your health appointments with your calendar.",
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="googleCalendar">
                    {t("settings.googleCalendar", "Google Calendar")}
                  </Label>
                  <Switch
                    id="googleCalendar"
                    checked={preferences.integrations.googleCalendar}
                    onCheckedChange={(v) => updateField("integrations.googleCalendar", v)}
                    disabled
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="appleCalendar">
                    {t("settings.appleCalendar", "Apple Calendar")}
                  </Label>
                  <Switch
                    id="appleCalendar"
                    checked={preferences.integrations.appleCalendar}
                    onCheckedChange={(v) => updateField("integrations.appleCalendar", v)}
                    disabled
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  {t(
                    "settings.calendarSyncUnavailable",
                    "Calendar sync is not yet available. We're working on adding these integrations soon.",
                  )}
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Reports & Exports Tab */}
        <TabsContent value="reports" className="space-y-6 p-4">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>{t("settings.reportSettings", "Health Report Settings")}</CardTitle>
                <CardDescription>
                  {t("settings.reportSettingsDescription", "Customize your health reports.")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="defaultTimeRange">
                    {t("settings.defaultTimeRange", "Default Time Range (days)")}
                  </Label>
                  <Select
                    value={preferences.reports.defaultTimeRange.toString()}
                    onValueChange={(v) => updateField("reports.defaultTimeRange", parseInt(v))}
                  >
                    <SelectTrigger id="defaultTimeRange" className="mt-1.5">
                      <SelectValue placeholder="Select time range" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7">7 days</SelectItem>
                      <SelectItem value="14">14 days</SelectItem>
                      <SelectItem value="30">30 days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>{t("settings.reportSections", "Include in Reports")}</Label>
                  <div className="space-y-2 mt-2">
                    {Object.entries(preferences.reports.includeSections).map(([key, value]) => (
                      <div key={key} className="flex items-center justify-between">
                        <Label htmlFor={key} className="capitalize">
                          {key.replace(/([A-Z])/g, " $1")}
                        </Label>
                        <Switch
                          id={key}
                          checked={value}
                          onCheckedChange={(v) => updateField(`reports.includeSections.${key}`, v)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t("settings.dataExport", "Data Export")}</CardTitle>
                <CardDescription>
                  {t("settings.dataExportDescription", "Export your health data.")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button disabled>{t("settings.exportCSV", "Export Data as CSV")}</Button>
                <Button disabled className="ml-2">
                  {t("settings.exportJSON", "Export Data as JSON")}
                </Button>
                <p className="text-sm text-muted-foreground">
                  {t(
                    "settings.dataExportUnavailable",
                    "Data export is not yet available. We're working on adding this feature soon.",
                  )}
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Accessibility Tab */}
        <TabsContent value="accessibility" className="space-y-6 p-4">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>{t("settings.display", "Display")}</CardTitle>
                <CardDescription>
                  {t("settings.displayDescription", "Customize how content is displayed.")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="highContrast">
                    {t("settings.highContrast", "High Contrast Mode")}
                  </Label>
                  <Switch
                    id="highContrast"
                    checked={preferences.accessibility.highContrast}
                    onCheckedChange={(v) => updateField("accessibility.highContrast", v)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="reducedMotion">
                    {t("settings.reducedMotion", "Reduced Motion")}
                  </Label>
                  <Switch
                    id="reducedMotion"
                    checked={preferences.accessibility.reducedMotion}
                    onCheckedChange={(v) => updateField("accessibility.reducedMotion", v)}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t("settings.screenReader", "Screen Reader Support")}</CardTitle>
                <CardDescription>
                  {t(
                    "settings.screenReaderDescription",
                    "Improve compatibility with screen readers.",
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="screenReader">
                    {t("settings.enableScreenReader", "Enable Screen Reader Support")}
                  </Label>
                  <Switch
                    id="screenReader"
                    checked={preferences.accessibility.screenReader}
                    onCheckedChange={(v) => updateField("accessibility.screenReader", v)}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
