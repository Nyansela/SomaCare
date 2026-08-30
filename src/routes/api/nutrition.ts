import { createFileRoute } from "@tanstack/react-router";
import { generateText } from "ai";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export const Route = createFileRoute("/api/nutrition")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("Authorization") ?? "";
        if (!auth.startsWith("Bearer ")) {
          return new Response("Unauthorized", { status: 401 });
        }
        const token = auth.slice(7);

        // Create AI model via the multi-provider gateway
        const { createAiModel } = await import("@/lib/ai-gateway.server");
        const model = createAiModel();

        const supabase = createClient<Database>(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_PUBLISHABLE_KEY!,
          {
            global: { headers: { Authorization: `Bearer ${token}` } },
            auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
          },
        );

        const { data: userData, error: userErr } = await supabase.auth.getUser();
        if (userErr || !userData.user) {
          return new Response("Unauthorized", { status: 401 });
        }
        const userId = userData.user.id;

        // Fetch health context
        const [{ data: profile }, { data: healthVault }, { data: medications }] = await Promise.all(
          [
            supabase
              .from("profiles")
              .select("*, allergies, chronic_conditions")
              .eq("id", userId)
              .maybeSingle(),
            supabase.from("health_vault").select("*").eq("user_id", userId).maybeSingle(),
            supabase
              .from("medications")
              .select("name, dose, frequency")
              .eq("user_id", userId)
              .eq("active", true)
              .limit(20),
          ],
        );

        // Build user context for prompt
        const allergies =
          healthVault?.allergies?.join(", ") || profile?.allergies?.join(", ") || "None";
        const chronicConditions =
          healthVault?.chronic_conditions?.join(", ") ||
          profile?.chronic_conditions?.join(", ") ||
          "None";
        const dietaryPreference = healthVault?.dietary_preference || "none";
        const dietaryOther = healthVault?.dietary_preference_other || "";
        const healthGoals = healthVault?.health_goals?.join(", ") || "General wellness";
        const age = healthVault?.age || "";
        const gender = healthVault?.gender || "";
        const weight = healthVault?.body_weight_kg || "";
        const isPregnant = healthVault?.is_pregnant ? "Yes" : "No";

        // Format medications for the prompt
        const medsList =
          medications
            ?.map((m) => {
              return `${m.name}${m.dose ? ` ${m.dose}` : ""}${m.frequency ? ` (${m.frequency})` : ""}`;
            })
            .join(", ") || "None";

        const prompt = `You are a nutrition planning assistant specializing in authentic Ghanaian cuisine (e.g., waakye, banku with tilapia, jollof rice, kenkey, fufu with light soup, red red, kelewele, plantain-based meals). Generate a personalized daily meal plan with Ghanaian dishes and medication timing for a user, explaining why dishes fit their health profile.

USER PROFILE:
- Age: ${age || "Not specified"}
- Gender: ${gender || "Not specified"}
- Weight: ${weight ? weight + " kg" : "Not specified"}
- Dietary Preference: ${dietaryPreference === "other" ? dietaryOther : dietaryPreference}
- Allergies: ${allergies}
- Chronic Conditions: ${chronicConditions}
- Health Goals: ${healthGoals}
- Pregnant: ${isPregnant}

CURRENT MEDICATIONS: ${medsList}

Generate a response in this EXACT JSON format (only valid JSON, no other text):

{
  "breakfast": {
    "time": "string (e.g., 8:00 AM)",
    "description": "string (meal description)",
    "calories": number
  },
  "lunch": {
    "time": "string (e.g., 12:30 PM)", 
    "description": "string",
    "calories": number
  },
  "dinner": {
    "time": "string (e.g., 7:00 PM)",
    "description": "string",
    "calories": number
  },
  "snacks": [
    { "time": "string", "description": "string", "calories": number }
  ],
  "medication_timing": [
    { "medication": "string (exact name from user's medications)", "timing": "string (e.g., with breakfast, 2 hours after dinner)", "reason": "string (brief general guidance)" }
  ],
  "notes": "string (any dietary recommendations based on their conditions/goals)"
}

IMPORTANT:
- Ensure all meals avoid the user's listed allergies
- Consider their dietary preference (${dietaryPreference})
- Factor in any chronic conditions in meal suggestions
- Medication timing is GENERAL GUIDANCE ONLY - always remind users to follow their pharmacist/doctor's instructions
- If user has no medications, return empty array for medication_timing
- Return valid JSON only`;

        const result = await generateText({
          model,
          messages: [{ role: "user", content: prompt }],
        });

        let planData: Record<string, unknown>;
        try {
          planData = JSON.parse(result.text);
        } catch {
          return Response.json({ error: "Failed to generate plan" }, { status: 500 });
        }

        // Extract medication reminders for storage
        const medicationTimings = planData.medication_timing as
          Array<{ medication: string; timing: string; reason?: string }> | undefined;
        const medicationReminders = (medicationTimings || []).map((m) => ({
          medication: m.medication,
          timing: m.timing,
          reason: m.reason,
        }));

        // Save to database
        const { error: insertError } = await supabase.from("nutrition_plans").insert({
          user_id: userId,
          plan_data: planData,
          medication_reminders: medicationReminders,
        });

        if (insertError) {
          console.error("Failed to save nutrition plan:", insertError);
        }

        return Response.json({
          plan: planData,
          generatedAt: new Date().toISOString(),
        });
      },
    },
  },
});
