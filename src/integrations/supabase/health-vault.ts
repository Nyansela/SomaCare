import type { Database } from "./types";

/**
 * Health Vault Types
 * Extended health profile data for AI context and doctor sharing
 */

export type HealthVault = Database["public"]["Tables"]["health_vault"]["Row"];
export type HealthVaultInsert = Database["public"]["Tables"]["health_vault"]["Insert"];
export type HealthVaultUpdate = Database["public"]["Tables"]["health_vault"]["Update"];

// Allergy types
export type AllergySeverity = "mild" | "moderate" | "severe" | "life_threatening";

export interface Allergy {
  id: string;
  user_id: string;
  allergen: string;
  reaction: string | null;
  severity: AllergySeverity | null;
  created_at: string;
}

export type AllergyInsert = Omit<Allergy, "id" | "created_at">;
export type AllergyUpdate = Partial<Omit<Allergy, "id" | "user_id" | "created_at">>;

// Medical history event types
export type MedicalEventType = "surgery" | "immunization" | "family_history";

export interface MedicalHistoryEvent {
  id: string;
  user_id: string;
  event_type: MedicalEventType;
  description: string;
  related_person: string | null;
  event_date: string | null;
  created_at: string;
}

export type MedicalHistoryEventInsert = Omit<MedicalHistoryEvent, "id" | "created_at">;
export type MedicalHistoryEventUpdate = Partial<
  Omit<MedicalHistoryEvent, "id" | "user_id" | "created_at">
>;

/**
 * Structured health context for AI conversations and PDF export
 */
export interface HealthContext {
  profile: {
    display_name: string | null;
    date_of_birth: string | null;
    sex: string | null;
    blood_type: string | null;
    height_cm: number | null;
    allergies: string[] | null;
    chronic_conditions: string[] | null;
    emergency_contacts: unknown[] | null;
  };

  healthVault: {
    age: number | null;
    body_weight_kg: number | null;
    gender: string | null;
    country: string | null;
    city: string | null;
    past_illnesses: string[] | null;
    hereditary_diseases: string[] | null;
    emergency_contact_name: string | null;
    emergency_contact_phone: string | null;
    allergies: string[] | null;
    chronic_conditions: string[] | null;
    smoking_status: string | null;
    alcohol_use: string | null;
    dietary_preference: string | null;
    dietary_preference_other: string | null;
    health_goals: string[] | null;
    is_pregnant: boolean | null;
  };

  // New structured allergies with severity
  allergies: {
    allergen: string;
    reaction: string | null;
    severity: string | null;
  }[];

  // Medical history events
  medicalHistoryEvents: {
    event_type: string;
    description: string;
    related_person: string | null;
    event_date: string | null;
  }[];

  latestVitals: {
    kind: string;
    value: number;
    unit: string | null;
    taken_at: string;
  }[];

  activeMedications: {
    name: string;
    dose: string | null;
    frequency: string | null;
  }[];

  flaggedAbnormalities: string[];

  // Sleep data
  sleepLogs: {
    logged_date: string;
    bedtime: string;
    wake_time: string;
    hours_slept: number;
    quality_rating: number | null;
  }[];

  sleepSummary: {
    avgHoursPerNight: number;
    avgQuality: number | null;
    totalLogs: number;
    lastLoggedDate: string | null;
  } | null;

  // Hydration data
  hydrationSummary: {
    todayTotalMl: number;
    dailyGoalMl: number;
    progressPercent: number;
    lastLoggedAt: string | null;
  } | null;

  // Fitness data
  fitnessSummary: {
    weekMinutes: number;
    weekWorkouts: number;
    lastWorkoutDate: string | null;
  } | null;
}

// Gender options
export const GENDER_OPTIONS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
] as const;

// Smoking status options
export const SMOKING_STATUS_OPTIONS = [
  { value: "never", label: "Never smoked" },
  { value: "former", label: "Former smoker" },
  { value: "current", label: "Current smoker" },
  { value: "occasional", label: "Occasional / Social" },
] as const;

// Alcohol use options
export const ALCOHOL_USE_OPTIONS = [
  { value: "none", label: "None / Teetotaler" },
  { value: "occasional", label: "Occasional (1-2 drinks/week)" },
  { value: "moderate", label: "Moderate (3-7 drinks/week)" },
  { value: "heavy", label: "Heavy (8+ drinks/week)" },
] as const;

// Dietary preference options
export const DIETARY_PREFERENCE_OPTIONS = [
  { value: "none", label: "No restrictions" },
  { value: "vegetarian", label: "Vegetarian" },
  { value: "vegan", label: "Vegan" },
  { value: "pescatarian", label: "Pescatarian" },
  { value: "halal", label: "Halal" },
  { value: "kosher", label: "Kosher" },
  { value: "keto", label: "Keto" },
  { value: "paleo", label: "Paleo" },
  { value: "other", label: "Other" },
] as const;

// Health goals options
export const HEALTH_GOALS_OPTIONS = [
  { value: "weight_management", label: "Weight management" },
  { value: "manage_chronic_condition", label: "Manage chronic condition" },
  { value: "general_wellness", label: "General wellness" },
  { value: "improve_fitness", label: "Improve fitness" },
  { value: "better_sleep", label: "Better sleep" },
  { value: "stress_management", label: "Stress management" },
  { value: "improve_diet", label: "Improve diet" },
  { value: "increase_energy", label: "Increase energy" },
  { value: "heart_health", label: "Heart health" },
  { value: "mental_health", label: "Mental health" },
] as const;

// Allergy severity options
export const ALLERGY_SEVERITY_OPTIONS = [
  { value: "mild", label: "Mild", description: "Minor symptoms, no interference" },
  { value: "moderate", label: "Moderate", description: "Noticeable symptoms, some interference" },
  {
    value: "severe",
    label: "Severe",
    description: "Significant symptoms, interferes with daily life",
  },
  {
    value: "life_threatening",
    label: "Life-threatening",
    description: "Anaphylaxis risk, requires immediate care",
  },
] as const;

// Medical event type options
export const MEDICAL_EVENT_TYPE_OPTIONS = [
  { value: "surgery", label: "Surgery" },
  { value: "immunization", label: "Immunization / Vaccination" },
  { value: "family_history", label: "Family History" },
] as const;
