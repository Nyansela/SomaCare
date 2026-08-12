import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { HealthContext } from "@/integrations/supabase/health-vault";
import { detectVitalAbnormalities } from "./vital-abnormalities";

/**
 * Get complete health context for a user.
 * Used for AI conversation context and PDF export for doctor sharing.
 */
export async function getHealthContext(
  supabaseUrl: string,
  supabaseKey: string,
  userId: string,
  isAdmin: boolean = false,
): Promise<HealthContext> {
  const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  // Parallel fetch all data sources
  const [
    { data: profile },
    { data: healthVault },
    { data: vitals },
    { data: medications },
    { data: appointments },
    { data: allergies },
    { data: medicalHistory },
    { data: sleepLogs },
    { data: hydrationLogs },
    { data: fitnessLogs },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "display_name, date_of_birth, sex, blood_type, height_cm, allergies, chronic_conditions, emergency_contacts",
      )
      .eq("id", userId)
      .maybeSingle(),

    supabase.from("health_vault").select("*").eq("user_id", userId).maybeSingle(),

    supabase
      .from("vitals")
      .select("kind, value, unit, taken_at")
      .eq("user_id", userId)
      .order("taken_at", { ascending: false })
      .limit(20),

    supabase
      .from("medications")
      .select("name, dose, frequency")
      .eq("user_id", userId)
      .eq("active", true)
      .limit(20),

    supabase
      .from("appointments")
      .select("provider_name, specialty, starts_at, status")
      .eq("user_id", userId)
      .order("starts_at", { ascending: false })
      .limit(10),

    // New: Fetch structured allergies
    supabase
      .from("allergies")
      .select("allergen, reaction, severity")
      .eq("user_id", userId)
      .order("severity", { ascending: false }),

    // New: Fetch medical history events
    supabase
      .from("medical_history_events")
      .select("event_type, description, related_person, event_date")
      .eq("user_id", userId)
      .order("event_date", { ascending: false }),

    // Fetch recent sleep logs (last 14 days)
    supabase
      .from("sleep_logs")
      .select("logged_date, bedtime, wake_time, quality_rating")
      .eq("user_id", userId)
      .order("logged_date", { ascending: false })
      .limit(14),

    // Fetch today's hydration
    supabase
      .from("hydration_logs")
      .select("amount_ml, logged_at")
      .eq("user_id", userId)
      .gte("logged_at", new Date().toISOString().split("T")[0]),

    // Fetch this week's fitness logs
    (() => {
      const startOfWeek = new Date();
      startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
      return supabase
        .from("fitness_logs")
        .select("logged_date, duration_minutes")
        .eq("user_id", userId)
        .gte("logged_date", startOfWeek.toISOString().split("T")[0]);
    })(),
  ]);

  // Process vitals into grouped latest values
  const latestVitalsMap = new Map<
    string,
    { kind: string; value: number; unit: string | null; taken_at: string }
  >();
  vitals?.forEach((v) => {
    if (!latestVitalsMap.has(v.kind)) {
      latestVitalsMap.set(v.kind, {
        kind: v.kind,
        value: v.value,
        unit: v.unit,
        taken_at: v.taken_at,
      });
    }
  });

  // Check for abnormalities in vitals using the shared function
  const flaggedAbnormalities = detectVitalAbnormalities(
    (vitals || []).map((v) => ({
      kind: v.kind,
      value: v.value,
      unit: v.unit,
      taken_at: v.taken_at,
    })),
  ).map((ab) => ab.message);

  // Build the context object
  const context: HealthContext = {
    profile: {
      display_name: profile?.display_name ?? null,
      date_of_birth: profile?.date_of_birth ?? null,
      sex: profile?.sex ?? null,
      blood_type: profile?.blood_type ?? null,
      height_cm: profile?.height_cm ?? null,
      allergies: profile?.allergies ?? null,
      chronic_conditions: profile?.chronic_conditions ?? null,
      emergency_contacts: (profile?.emergency_contacts as unknown[] | null) ?? null,
    },

    healthVault: {
      age: healthVault?.age ?? null,
      body_weight_kg: healthVault?.body_weight_kg ?? null,
      gender: healthVault?.gender ?? null,
      country: healthVault?.country ?? null,
      city: healthVault?.city ?? null,
      past_illnesses: healthVault?.past_illnesses ?? null,
      hereditary_diseases: healthVault?.hereditary_diseases ?? null,
      emergency_contact_name: healthVault?.emergency_contact_name ?? null,
      emergency_contact_phone: healthVault?.emergency_contact_phone ?? null,
      allergies: healthVault?.allergies ?? null,
      chronic_conditions: healthVault?.chronic_conditions ?? null,
      smoking_status: healthVault?.smoking_status ?? null,
      alcohol_use: healthVault?.alcohol_use ?? null,
      dietary_preference: healthVault?.dietary_preference ?? null,
      dietary_preference_other: healthVault?.dietary_preference_other ?? null,
      health_goals: healthVault?.health_goals ?? null,
      is_pregnant: healthVault?.is_pregnant ?? null,
    },

    // Structured allergies with severity
    allergies: (allergies ?? []).map((a) => ({
      allergen: a.allergen,
      reaction: a.reaction,
      severity: a.severity,
    })),

    // Medical history events
    medicalHistoryEvents: (medicalHistory ?? []).map((e) => ({
      event_type: e.event_type,
      description: e.description,
      related_person: e.related_person,
      event_date: e.event_date,
    })),

    latestVitals: Array.from(latestVitalsMap.values()),

    activeMedications: (medications ?? []).map((m) => ({
      name: m.name,
      dose: m.dose,
      frequency: m.frequency,
    })),

    flaggedAbnormalities,

    // Process sleep data
    sleepLogs: (() => {
      const logs: Array<{
        logged_date: string;
        bedtime: string;
        wake_time: string;
        hours_slept: number;
        quality_rating: number | null;
      }> = [];
      sleepLogs?.forEach((log) => {
        const bedtime = new Date(log.bedtime);
        const wakeTime = new Date(log.wake_time);
        let hours = (wakeTime.getTime() - bedtime.getTime()) / (1000 * 60 * 60);
        if (hours < 0) hours += 24;
        logs.push({
          logged_date: log.logged_date,
          bedtime: log.bedtime,
          wake_time: log.wake_time,
          hours_slept: Math.round(hours * 10) / 10,
          quality_rating: log.quality_rating,
        });
      });
      return logs;
    })(),

    sleepSummary:
      sleepLogs && sleepLogs.length > 0
        ? {
            avgHoursPerNight:
              sleepLogs.reduce((sum, log) => {
                const bedtime = new Date(log.bedtime);
                const wakeTime = new Date(log.wake_time);
                let hours = (wakeTime.getTime() - bedtime.getTime()) / (1000 * 60 * 60);
                if (hours < 0) hours += 24;
                return sum + hours;
              }, 0) / sleepLogs.length,
            avgQuality:
              sleepLogs.filter((l) => l.quality_rating).length > 0
                ? sleepLogs
                    .filter((l) => l.quality_rating)
                    .reduce((sum, l) => sum + (l.quality_rating || 0), 0) /
                  sleepLogs.filter((l) => l.quality_rating).length
                : null,
            totalLogs: sleepLogs.length,
            lastLoggedDate: sleepLogs[0]?.logged_date || null,
          }
        : null,

    // Hydration summary
    hydrationSummary: (() => {
      const today = new Date().toISOString().split("T")[0];
      const todayLogs = hydrationLogs?.filter((log) => log.logged_at.split("T")[0] === today) || [];
      const todayTotal = todayLogs.reduce((sum, log) => sum + log.amount_ml, 0);

      // Calculate goal: 35ml per kg, fallback to 2500ml
      const weightKg = healthVault?.body_weight_kg;
      const goalMl = weightKg ? Math.round(weightKg * 35) : 2500;

      return {
        todayTotalMl: todayTotal,
        dailyGoalMl: goalMl,
        progressPercent: goalMl > 0 ? Math.round((todayTotal / goalMl) * 100) : 0,
        lastLoggedAt: hydrationLogs?.[0]?.logged_at || null,
      };
    })(),

    // Fitness summary
    fitnessSummary: (() => {
      const weekMinutes = fitnessLogs?.reduce((sum, log) => sum + log.duration_minutes, 0) || 0;
      const weekWorkouts = fitnessLogs?.length || 0;
      const lastWorkoutDate = fitnessLogs?.[0]?.logged_date || null;

      return {
        weekMinutes,
        weekWorkouts,
        lastWorkoutDate,
      };
    })(),
  };

  return context;
}

/**
 * Format health context for AI prompts - human-readable format
 */
export function formatHealthContextForAI(context: HealthContext): string {
  const parts: string[] = [];

  // === DEMOGRAPHICS ===
  parts.push("═══ PATIENT DEMOGRAPHICS ═══");
  if (context.profile.display_name) {
    parts.push(`Name: ${context.profile.display_name}`);
  }
  if (context.healthVault.age) {
    parts.push(`Age: ${context.healthVault.age} years`);
  }
  if (context.healthVault.gender) {
    parts.push(`Gender: ${context.healthVault.gender}`);
  }
  if (context.healthVault.is_pregnant !== null) {
    parts.push(`Pregnant: ${context.healthVault.is_pregnant ? "Yes" : "No"}`);
  }
  if (context.profile.blood_type) {
    parts.push(`Blood Type: ${context.profile.blood_type}`);
  }
  if (context.profile.height_cm) {
    parts.push(`Height: ${context.profile.height_cm} cm`);
  }
  if (context.healthVault.body_weight_kg) {
    parts.push(`Weight: ${context.healthVault.body_weight_kg} kg`);
  }
  if (context.healthVault.city || context.healthVault.country) {
    parts.push(
      `Location: ${[context.healthVault.city, context.healthVault.country].filter(Boolean).join(", ")}`,
    );
  }

  // === LIFESTYLE ===
  parts.push("\n═══ LIFESTYLE ═══");
  if (context.healthVault.smoking_status) {
    parts.push(`Smoking: ${context.healthVault.smoking_status}`);
  }
  if (context.healthVault.alcohol_use) {
    parts.push(`Alcohol: ${context.healthVault.alcohol_use}`);
  }
  if (context.healthVault.dietary_preference) {
    const diet =
      context.healthVault.dietary_preference === "other"
        ? context.healthVault.dietary_preference_other || "other"
        : context.healthVault.dietary_preference;
    parts.push(`Diet: ${diet}`);
  }
  if (context.healthVault.health_goals && context.healthVault.health_goals.length > 0) {
    parts.push(`Health Goals: ${context.healthVault.health_goals.join(", ")}`);
  }

  // === ALLERGIES (with severity) ===
  if (context.allergies.length > 0) {
    parts.push("\n═══ ALLERGIES ═══");
    context.allergies.forEach((a) => {
      const severity = a.severity ? ` [${a.severity.toUpperCase()}]` : "";
      const reaction = a.reaction ? ` - ${a.reaction}` : "";
      parts.push(`• ${a.allergen}${severity}${reaction}`);
    });
  }

  // === MEDICAL HISTORY ===
  if (context.healthVault.past_illnesses && context.healthVault.past_illnesses.length > 0) {
    parts.push("\n═══ PAST ILLNESSES ═══");
    context.healthVault.past_illnesses.forEach((illness) => {
      parts.push(`• ${illness}`);
    });
  }

  if (context.healthVault.chronic_conditions && context.healthVault.chronic_conditions.length > 0) {
    parts.push("\n═══ CHRONIC CONDITIONS ═══");
    context.healthVault.chronic_conditions.forEach((condition) => {
      parts.push(`• ${condition}`);
    });
  }

  // === FAMILY HISTORY (from medical history events) ===
  const familyHistory = context.medicalHistoryEvents.filter(
    (e) => e.event_type === "family_history",
  );
  if (familyHistory.length > 0) {
    parts.push("\n═══ FAMILY MEDICAL HISTORY ═══");
    familyHistory.forEach((e) => {
      const person = e.related_person ? ` (${e.related_person})` : "";
      parts.push(`• ${e.description}${person}`);
    });
  }

  // === SURGERIES & PROCEDURES ===
  const surgeries = context.medicalHistoryEvents.filter((e) => e.event_type === "surgery");
  if (surgeries.length > 0) {
    parts.push("\n═══ SURGERIES / PROCEDURES ═══");
    surgeries.forEach((e) => {
      const date = e.event_date ? ` (${e.event_date})` : "";
      parts.push(`• ${e.description}${date}`);
    });
  }

  // === IMMUNIZATIONS ===
  const immunizations = context.medicalHistoryEvents.filter((e) => e.event_type === "immunization");
  if (immunizations.length > 0) {
    parts.push("\n═══ IMMUNIZATIONS ═══");
    immunizations.forEach((e) => {
      const date = e.event_date ? ` (${e.event_date})` : "";
      parts.push(`• ${e.description}${date}`);
    });
  }

  // === CURRENT MEDICATIONS ===
  if (context.activeMedications.length > 0) {
    parts.push("\n═══ CURRENT MEDICATIONS ═══");
    context.activeMedications.forEach((med) => {
      const dose = med.dose ? ` ${med.dose}` : "";
      const freq = med.frequency ? ` (${med.frequency})` : "";
      parts.push(`• ${med.name}${dose}${freq}`);
    });
  }

  // === LATEST VITALS ===
  if (context.latestVitals.length > 0) {
    parts.push("\n═══ LATEST VITALS ═══");
    context.latestVitals.forEach((v) => {
      const unit = v.unit ? ` ${v.unit}` : "";
      const date = new Date(v.taken_at).toLocaleDateString();
      parts.push(`• ${v.kind}: ${v.value}${unit} (${date})`);
    });
  }

  // === SLEEP ===
  if (context.sleepSummary && context.sleepSummary.totalLogs > 0) {
    parts.push("\n═══ SLEEP PATTERNS ═══");
    parts.push(`Average: ${context.sleepSummary.avgHoursPerNight.toFixed(1)} hours/night`);
    if (context.sleepSummary.avgQuality) {
      parts.push(`Average Quality: ${context.sleepSummary.avgQuality.toFixed(1)}/5`);
    }
    parts.push(`Total tracked: ${context.sleepSummary.totalLogs} nights`);
    if (context.sleepSummary.lastLoggedDate) {
      parts.push(`Last logged: ${context.sleepSummary.lastLoggedDate}`);
    }
  }

  // === HYDRATION ===
  if (context.hydrationSummary) {
    parts.push("\n═══ HYDRATION TODAY ═══");
    parts.push(
      `Intake: ${context.hydrationSummary.todayTotalMl}ml / ${context.hydrationSummary.dailyGoalMl}ml (${context.hydrationSummary.progressPercent}%)`,
    );
  }

  // === FITNESS ACTIVITY ===
  if (context.fitnessSummary && context.fitnessSummary.weekWorkouts > 0) {
    parts.push("\n═══ FITNESS THIS WEEK ═══");
    parts.push(
      `Total: ${context.fitnessSummary.weekMinutes} minutes, ${context.fitnessSummary.weekWorkouts} workouts`,
    );
    if (context.fitnessSummary.lastWorkoutDate) {
      parts.push(`Last workout: ${context.fitnessSummary.lastWorkoutDate}`);
    }
  }

  // === FLAGGED ABNORMALITIES ===
  if (context.flaggedAbnormalities.length > 0) {
    parts.push("\n═══ FLAGGED HEALTH CONCERNS ═══");
    context.flaggedAbnormalities.forEach((a) => {
      parts.push(`⚠️ ${a}`);
    });
  }

  // === EMERGENCY CONTACT ===
  if (context.healthVault.emergency_contact_name || context.healthVault.emergency_contact_phone) {
    parts.push("\n═══ EMERGENCY CONTACT ═══");
    if (context.healthVault.emergency_contact_name) {
      parts.push(`Name: ${context.healthVault.emergency_contact_name}`);
    }
    if (context.healthVault.emergency_contact_phone) {
      parts.push(`Phone: ${context.healthVault.emergency_contact_phone}`);
    }
  }

  return parts.join("\n");
}

/**
 * Generate a shareable health summary for doctors
 */
export function generateDoctorSummary(context: HealthContext): string {
  const lines: string[] = [];

  lines.push("═══════════════════════════════════════════════════");
  lines.push("           HEALTH PROFILE SUMMARY");
  lines.push("═══════════════════════════════════════════════════");
  lines.push("");

  // Demographics
  lines.push("▸ PERSONAL INFORMATION");
  lines.push("─────────────────────────────────────────────────");
  if (context.profile.display_name) lines.push(`Name: ${context.profile.display_name}`);
  if (context.healthVault.age) lines.push(`Age: ${context.healthVault.age} years`);
  if (context.healthVault.gender) lines.push(`Gender: ${context.healthVault.gender}`);
  if (context.healthVault.is_pregnant !== null)
    lines.push(`Pregnant: ${context.healthVault.is_pregnant ? "Yes" : "No"}`);
  if (context.profile.blood_type) lines.push(`Blood Type: ${context.profile.blood_type}`);
  if (context.profile.height_cm) lines.push(`Height: ${context.profile.height_cm} cm`);
  if (context.healthVault.body_weight_kg)
    lines.push(`Weight: ${context.healthVault.body_weight_kg} kg`);
  if (context.healthVault.city || context.healthVault.country) {
    lines.push(
      `Location: ${[context.healthVault.city, context.healthVault.country].filter(Boolean).join(", ")}`,
    );
  }
  lines.push("");

  // Lifestyle
  lines.push("▸ LIFESTYLE");
  lines.push("─────────────────────────────────────────────────");
  if (context.healthVault.smoking_status)
    lines.push(`Smoking: ${context.healthVault.smoking_status}`);
  if (context.healthVault.alcohol_use) lines.push(`Alcohol: ${context.healthVault.alcohol_use}`);
  if (context.healthVault.dietary_preference) {
    const diet =
      context.healthVault.dietary_preference === "other"
        ? context.healthVault.dietary_preference_other || "other"
        : context.healthVault.dietary_preference;
    lines.push(`Diet: ${diet}`);
  }
  if (context.healthVault.health_goals && context.healthVault.health_goals.length > 0) {
    lines.push(`Goals: ${context.healthVault.health_goals.join(", ")}`);
  }
  lines.push("");

  // Allergies
  if (context.allergies.length > 0) {
    lines.push("▸ ALLERGIES");
    lines.push("─────────────────────────────────────────────────");
    context.allergies.forEach((a) => {
      const severity = a.severity ? ` [${a.severity}]` : "";
      const reaction = a.reaction ? ` - ${a.reaction}` : "";
      lines.push(`• ${a.allergen}${severity}${reaction}`);
    });
    lines.push("");
  }

  // Medical History
  if (context.healthVault.past_illnesses && context.healthVault.past_illnesses.length > 0) {
    lines.push("▸ PAST ILLNESSES");
    lines.push("─────────────────────────────────────────────────");
    context.healthVault.past_illnesses.forEach((illness) => lines.push(`• ${illness}`));
    lines.push("");
  }

  if (context.healthVault.chronic_conditions && context.healthVault.chronic_conditions.length > 0) {
    lines.push("▸ CHRONIC CONDITIONS");
    lines.push("─────────────────────────────────────────────────");
    context.healthVault.chronic_conditions.forEach((condition) => lines.push(`• ${condition}`));
    lines.push("");
  }

  // Surgeries
  const surgeries = context.medicalHistoryEvents.filter((e) => e.event_type === "surgery");
  if (surgeries.length > 0) {
    lines.push("▸ SURGERIES / PROCEDURES");
    lines.push("─────────────────────────────────────────────────");
    surgeries.forEach((e) => {
      const date = e.event_date ? ` (${e.event_date})` : "";
      lines.push(`• ${e.description}${date}`);
    });
    lines.push("");
  }

  // Immunizations
  const immunizations = context.medicalHistoryEvents.filter((e) => e.event_type === "immunization");
  if (immunizations.length > 0) {
    lines.push("▸ IMMUNIZATIONS");
    lines.push("─────────────────────────────────────────────────");
    immunizations.forEach((e) => {
      const date = e.event_date ? ` (${e.event_date})` : "";
      lines.push(`• ${e.description}${date}`);
    });
    lines.push("");
  }

  // Family History
  const familyHistory = context.medicalHistoryEvents.filter(
    (e) => e.event_type === "family_history",
  );
  if (familyHistory.length > 0) {
    lines.push("▸ FAMILY MEDICAL HISTORY");
    lines.push("─────────────────────────────────────────────────");
    familyHistory.forEach((e) => {
      const person = e.related_person ? ` (${e.related_person})` : "";
      lines.push(`• ${e.description}${person}`);
    });
    lines.push("");
  }

  // Current medications
  if (context.activeMedications.length > 0) {
    lines.push("▸ CURRENT MEDICATIONS");
    lines.push("─────────────────────────────────────────────────");
    context.activeMedications.forEach((med) => {
      const dose = med.dose ? ` ${med.dose}` : "";
      const freq = med.frequency ? ` - ${med.frequency}` : "";
      lines.push(`• ${med.name}${dose}${freq}`);
    });
    lines.push("");
  }

  // Latest vitals
  if (context.latestVitals.length > 0) {
    lines.push("▸ LATEST VITALS");
    lines.push("─────────────────────────────────────────────────");
    context.latestVitals.forEach((v) => {
      const unit = v.unit ? ` ${v.unit}` : "";
      const date = new Date(v.taken_at).toLocaleDateString();
      lines.push(`• ${v.kind}: ${v.value}${unit} (${date})`);
    });
    lines.push("");
  }

  // Abnormalities
  if (context.flaggedAbnormalities.length > 0) {
    lines.push("▸ FLAGGED HEALTH CONCERNS");
    lines.push("─────────────────────────────────────────────────");
    context.flaggedAbnormalities.forEach((a) => lines.push(`⚠️ ${a}`));
    lines.push("");
  }

  // Sleep
  if (context.sleepSummary && context.sleepSummary.totalLogs > 0) {
    lines.push("▸ SLEEP PATTERNS");
    lines.push("─────────────────────────────────────────────────");
    lines.push(`Average: ${context.sleepSummary.avgHoursPerNight.toFixed(1)} hours/night`);
    if (context.sleepSummary.avgQuality) {
      lines.push(`Average Quality: ${context.sleepSummary.avgQuality.toFixed(1)}/5`);
    }
    lines.push(`Total tracked: ${context.sleepSummary.totalLogs} nights`);
    lines.push("");
  }

  // Hydration
  if (context.hydrationSummary) {
    lines.push("▸ HYDRATION TODAY");
    lines.push("─────────────────────────────────────────────────");
    lines.push(
      `Intake: ${context.hydrationSummary.todayTotalMl}ml / ${context.hydrationSummary.dailyGoalMl}ml (${context.hydrationSummary.progressPercent}%)`,
    );
    lines.push("");
  }

  // Fitness
  if (context.fitnessSummary && context.fitnessSummary.weekWorkouts > 0) {
    lines.push("▸ FITNESS THIS WEEK");
    lines.push("─────────────────────────────────────────────────");
    lines.push(
      `Total: ${context.fitnessSummary.weekMinutes} minutes, ${context.fitnessSummary.weekWorkouts} workouts`,
    );
    if (context.fitnessSummary.lastWorkoutDate) {
      lines.push(`Last workout: ${context.fitnessSummary.lastWorkoutDate}`);
    }
    lines.push("");
  }

  // Emergency contact
  if (context.healthVault.emergency_contact_name || context.healthVault.emergency_contact_phone) {
    lines.push("▸ EMERGENCY CONTACT");
    lines.push("─────────────────────────────────────────────────");
    if (context.healthVault.emergency_contact_name)
      lines.push(`Name: ${context.healthVault.emergency_contact_name}`);
    if (context.healthVault.emergency_contact_phone)
      lines.push(`Phone: ${context.healthVault.emergency_contact_phone}`);
    lines.push("");
  }

  lines.push("═══════════════════════════════════════════════════");
  lines.push("Generated by SomaCare");
  lines.push(`Date: ${new Date().toLocaleDateString()}`);

  return lines.join("\n");
}
