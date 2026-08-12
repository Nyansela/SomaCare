import { createFileRoute } from "@tanstack/react-router";
import { generateText } from "ai";
import { createClient } from "@supabase/supabase-js";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { Database } from "@/integrations/supabase/types";

export const Route = createFileRoute("/api/fitness-suggestion")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("Authorization") ?? "";
        if (!auth.startsWith("Bearer ")) {
          return new Response("Unauthorized", { status: 401 });
        }
        const token = auth.slice(7);

        // Check for NVIDIA API key
        const nvidiaApiKey = process.env.NVIDIA_API_KEY;
        if (!nvidiaApiKey) {
          return new Response(
            "AI provider not configured. Please set NVIDIA_API_KEY environment variable.",
            { status: 500 },
          );
        }

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
        const [{ data: healthVault }, { data: vitals }, { data: fitnessLogs }] = await Promise.all([
          supabase.from("health_vault").select("*").eq("user_id", userId).maybeSingle(),
          supabase
            .from("vitals")
            .select("kind, value, unit, taken_at")
            .eq("user_id", userId)
            .order("taken_at", { ascending: false })
            .limit(10),
          supabase
            .from("fitness_logs")
            .select("*")
            .eq("user_id", userId)
            .order("logged_date", { ascending: false })
            .limit(7),
        ]);

        // Get flagged abnormalities from vitals
        const latestVitals = new Map<string, { kind: string; value: number; unit: string }>();
        vitals?.forEach((v) => {
          if (!latestVitals.has(v.kind)) {
            latestVitals.set(v.kind, { kind: v.kind, value: v.value, unit: v.unit || "" });
          }
        });

        // Check for high blood pressure
        const bp = latestVitals.get("blood_pressure");
        let bpWarning = "";
        if (bp) {
          const parts = bp.value.toString().split("/");
          if (parts.length === 2) {
            const systolic = parseInt(parts[0], 10);
            if (systolic > 140) {
              bpWarning = "⚠️ Blood pressure is elevated - avoid intense cardio";
            }
          }
        }

        // Check heart rate
        const hr = latestVitals.get("heart_rate");
        let hrWarning = "";
        if (hr && hr.value > 100) {
          hrWarning = "⚠️ Resting heart rate is elevated - suggest light activity only";
        }

        // Recent workouts to avoid repetition
        const recentWorkouts =
          fitnessLogs
            ?.map((l) => l.workout_type)
            .filter(Boolean)
            .join(", ") || "none recently";

        // Build context
        const chronicConditions = healthVault?.chronic_conditions?.join(", ") || "None";
        const healthGoals = healthVault?.health_goals?.join(", ") || "General wellness";
        const age = healthVault?.age || "";
        const weight = healthVault?.body_weight_kg || "";

        // Create NVIDIA provider
        const nvidia = createOpenAICompatible({
          name: "nvidia-nim",
          baseURL: "https://integrate.api.nvidia.com/v1",
          headers: { Authorization: `Bearer ${nvidiaApiKey}` },
        });

        const prompt = `You are a friendly, encouraging fitness coach in Ghana. Give a single daily workout suggestion suitable for a Ghanaian context (e.g. morning/evening neighborhood walks, home bodyweight exercises, local fitness routines) that's realistic and low-pressure.

USER PROFILE:
- Age: ${age || "Not specified"}
- Weight: ${weight ? weight + " kg" : "Not specified"}
- Chronic conditions: ${chronicConditions}
- Health goals: ${healthGoals}

RECENT ACTIVITY:
- Recent workouts: ${recentWorkouts}
- This week's total: ${fitnessLogs?.reduce((sum, l) => sum + l.duration_minutes, 0) || 0} minutes

${bpWarning ? `- ${bpWarning}` : ""}
${hrWarning ? `- ${hrWarning}` : ""}

Generate a response in this EXACT JSON format (only valid JSON, no other text):

{
  "workout": "string (2-4 words, e.g., '30 min brisk walk')",
  "duration": "string (e.g., '20-30 minutes')",
  "intensity": "string (light, moderate, or intense)",
  "reason": "string (1 sentence why this suits them)",
  "tips": ["tip 1", "tip 2"]
}

IMPORTANT:
- Keep tone friendly, encouraging, NOT bootcamp-style
- Don't repeat workouts they did recently
- Factor in any health conditions or limitations
- Include safety note: "Stop and consult a doctor if you feel pain or discomfort during exercise"
- Return valid JSON only`;

        const result = await generateText({
          model: nvidia("meta/llama-3.1-70b-instruct"),
          messages: [{ role: "user", content: prompt }],
        });

        let suggestionData: Record<string, unknown>;
        try {
          suggestionData = JSON.parse(result.text);
        } catch {
          return Response.json({ error: "Failed to generate suggestion" }, { status: 500 });
        }

        const suggestion = `🏃 ${suggestionData.workout} (${suggestionData.duration})
   
${suggestionData.reason}

Tips: ${((suggestionData.tips as string[]) || []).join(" • ")}

⚠️ ${"Stop and consult a doctor if you feel pain or discomfort during exercise."}`;

        return Response.json({ suggestion });
      },
    },
  },
});
