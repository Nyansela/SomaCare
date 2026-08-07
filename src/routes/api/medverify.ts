import { createFileRoute } from "@tanstack/react-router";
import { generateText } from "ai";
import { createClient } from "@supabase/supabase-js";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { Database } from "@/integrations/supabase/types";
import { getHealthContext } from "@/lib/health-context";

type VerifyBody = { medicationName: string };

export const Route = createFileRoute("/api/medverify")({
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

        const body = (await request.json()) as VerifyBody;
        const { medicationName } = body;
        
        if (!medicationName || medicationName.trim().length === 0) {
          return new Response("Medication name required", { status: 400 });
        }

        // Get health context
        const healthContext = await getHealthContext(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_PUBLISHABLE_KEY!,
          userId
        );

        // Build context for medication check
        const allergies = healthContext.allergies.map(a => `${a.allergen}${a.severity ? ` [${a.severity}]` : ''}`).join(', ') || 'None';
        const chronicConditions = healthContext.healthVault.chronic_conditions?.join(', ') || 'None';
        const currentMeds = healthContext.activeMedications.map(m => `${m.name}${m.dose ? ` ${m.dose}` : ''}`).join(', ') || 'None';
        const pregnancy = healthContext.healthVault.is_pregnant ? 'Yes' : 'No/Not applicable';

        // Create NVIDIA provider
        const nvidia = createOpenAICompatible({
          name: "nvidia-nim",
          baseURL: "https://integrate.api.nvidia.com/v1",
          headers: { Authorization: `Bearer ${nvidiaApiKey}` },
        });

        // Generate medication safety check
        const prompt = `You are a medication safety checker operating in a Ghanaian healthcare context (considering common local medications, FDA Ghana guidelines, and patient safety practices). Analyze the following medication for a patient and provide safety information in a structured format.

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
          model: nvidia("meta/llama-3.1-70b-instruct"),
          messages: [{ role: "user", content: prompt }],
        });

        let parsedResult: Record<string, unknown>;
        try {
          parsedResult = JSON.parse(result.text);
        } catch {
          // If AI didn't return valid JSON, return a safe fallback
          parsedResult = {
            error: { status: "error", details: "Could not analyze medication. Please consult your doctor." }
          };
        }

        // Log the check
        const summary = parsedResult.overall 
          ? `${parsedResult.overall.status}: ${parsedResult.overall.summary}`
          : 'Check completed';
          
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
