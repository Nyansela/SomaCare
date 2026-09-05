import { createFileRoute } from "@tanstack/react-router";
import { generateText } from "ai";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { getHealthContext } from "@/lib/health-context";
import { aiLanguageInstruction, isSupportedAiLanguage } from "@/lib/ai-language.server";

type VerifyBody = { medicationName: string; language?: string };

export const Route = createFileRoute("/api/medverify")({
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

        const body = (await request.json()) as VerifyBody;
        const { medicationName, language } = body;

        if (!medicationName || medicationName.trim().length === 0) {
          return new Response("Medication name required", { status: 400 });
        }

        // Resolve UI language (client-sent wins, then profile preference)
        const { data: langProfile } = await supabase
          .from("profiles")
          .select("preferences")
          .eq("id", userId)
          .maybeSingle();
        const langPrefs = (langProfile?.preferences as Record<string, unknown>) || {};
        const userLanguage = isSupportedAiLanguage(language)
          ? language
          : (langPrefs.language as string) || "en";

        // Get health context
        const healthContext = await getHealthContext(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_PUBLISHABLE_KEY!,
          userId,
        );

        // Build context for medication check
        const allergies =
          healthContext.allergies
            .map((a) => `${a.allergen}${a.severity ? ` [${a.severity}]` : ""}`)
            .join(", ") || "None";
        const chronicConditions =
          healthContext.healthVault.chronic_conditions?.join(", ") || "None";
        const currentMeds =
          healthContext.activeMedications
            .map((m) => `${m.name}${m.dose ? ` ${m.dose}` : ""}`)
            .join(", ") || "None";
        const pregnancy = healthContext.healthVault.is_pregnant ? "Yes" : "No/Not applicable";

        // Generate medication safety check
        const prompt = `You are a medication safety checker operating in a Ghanaian healthcare context (considering common local medications, FDA Ghana guidelines, and patient safety practices). Analyze the following medication for a patient and provide safety information in a structured format.

${aiLanguageInstruction(userLanguage)}

PATIENT INFORMATION:
- Allergies: ${allergies}
- Chronic Conditions: ${chronicConditions}
- Current Medications: ${currentMeds}
- Pregnancy Status: ${pregnancy}

MEDICATION TO CHECK: ${medicationName}

Provide your response in this exact JSON format:
{
  "allergy_check": {
    "status": "safe" | "caution" | "unsafe",
    "details": "Brief explanation of any allergy concerns"
  },
  "interaction_check": {
    "status": "safe" | "caution" | "unsafe", 
    "details": "Brief explanation of any drug interactions"
  },
  "condition_check": {
    "status": "safe" | "caution" | "unsafe",
    "details": "Brief explanation of any condition-related risks"
  },
  "overall": {
    "status": "safe" | "caution" | "unsafe",
    "summary": "2-3 sentence overall assessment"
  },
  "disclaimer": "This is not medical advice. Always consult your doctor or pharmacist before taking any medication."
}

Respond ONLY with valid JSON, no other text.`;

        const result = await generateText({
          model,
          messages: [{ role: "user", content: prompt }],
        });

        let parsedResult: Record<string, unknown>;
        try {
          parsedResult = JSON.parse(result.text);
        } catch {
          // If AI didn't return valid JSON, return a safe fallback
          parsedResult = {
            error: {
              status: "error",
              details: "Could not analyze medication. Please consult your doctor.",
            },
          };
        }

        // Log the check
        const overall = parsedResult.overall as { status?: string; summary?: string } | undefined;
        const summary = overall
          ? `${overall.status || "unknown"}: ${overall.summary || "Check completed"}`
          : "Check completed";

        await supabase.from("medverify_checks").insert({
          user_id: userId,
          medication_name: medicationName,
          result_summary: summary,
        });

        return Response.json(parsedResult);
      },
    },
  },
});
