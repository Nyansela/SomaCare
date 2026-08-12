import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { createClient } from "@supabase/supabase-js";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { Database } from "@/integrations/supabase/types";
import { getHealthContext, formatHealthContextForAI } from "@/lib/health-context";

type ChatBody = { messages?: UIMessage[]; threadId?: string };

export const Route = createFileRoute("/api/chat")({
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
            "AI provider not configured. Please set NVIDIA_API_KEY environment variable. Get an API key from https://build.nvidia.com",
            { status: 500 },
          );
        }

        // Create NVIDIA NIM provider using OpenAI-compatible endpoint
        const nvidia = createOpenAICompatible({
          name: "nvidia-nim",
          baseURL: "https://integrate.api.nvidia.com/v1",
          headers: {
            Authorization: `Bearer ${nvidiaApiKey}`,
          },
        });

        const supabase = createClient<Database>(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_PUBLISHABLE_KEY!,
          {
            global: { headers: { Authorization: `Bearer ${token}` } },
            auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
          },
        );

        const { data: userData, error: userErr } = await supabase.auth.getUser();
        if (userErr || !userData.user) return new Response("Unauthorized", { status: 401 });
        const userId = userData.user.id;

        const body = (await request.json()) as ChatBody;
        const { messages, threadId } = body;
        if (!Array.isArray(messages) || !threadId) {
          return new Response("Bad request", { status: 400 });
        }

        // Verify thread ownership
        const { data: thread } = await supabase
          .from("ai_threads")
          .select("id,title")
          .eq("id", threadId)
          .eq("user_id", userId)
          .maybeSingle();
        if (!thread) return new Response("Thread not found", { status: 404 });

        // Load personalized health context using the shared function
        // This ONLY uses the authenticated user's ID - never client-supplied
        const healthContext = await getHealthContext(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_PUBLISHABLE_KEY!,
          userId,
        );

        // Fetch user's preferred language from profile preferences
        const { data: profileData } = await supabase
          .from("profiles")
          .select("preferences")
          .eq("id", userId)
          .maybeSingle();
        const userPrefs = (profileData?.preferences as Record<string, unknown>) || {};
        const userLanguage = (userPrefs.language as string) || "en";
        const langName =
          userLanguage === "tw"
            ? "Twi (Akan)"
            : userLanguage === "ee"
              ? "Ewe"
              : userLanguage === "ga"
                ? "Ga"
                : "English";

        // Format health context for AI
        const formattedHealthContext = formatHealthContextForAI(healthContext);

        const systemPrompt = `You are Adwoa, an empathetic, professional AI health companion. 

IMPORTANT CONTEXT ABOUT THE USER:
${formattedHealthContext}

PREFERRED LANGUAGE:
- Respond conversationally in the user's preferred language: ${langName} (${userLanguage}). Ensure natural phrasing and appropriate health/medical terminology in this language.

Your instructions:
- Assume a Ghanaian user context by default — local foods, common local health conditions/context (e.g., malaria awareness, hypertension, type 2 diabetes management), metric units (kg, cm, °C), awareness of local healthcare facilities (CHPS compounds, polyclinics, teaching hospitals), and respect for common local remedies/herbal practices (mentioned respectfully alongside medical advice, never replacing it).
- Use this health context naturally in your responses - for example, if the user asks about food, suggest authentic Ghanaian dishes (waakye, jollof, fufu, banku, etc.) and be aware of their allergies
- Do NOT repeat the user's health data back to them unless specifically relevant to the question
- Always recommend consulting a qualified clinician for diagnosis, treatment, or anything serious
- Never provide emergency medical advice - instead urge them to call emergency services
- If you're uncertain about something, say so honestly
- Provide clear, evidence-informed guidance

Style: warm, concise, structured with short paragraphs and bullet lists where helpful. Use markdown.`;

        // Persist the latest user message
        const lastMsg = messages[messages.length - 1];
        if (lastMsg?.role === "user") {
          await supabase.from("ai_messages").insert({
            thread_id: threadId,
            user_id: userId,
            role: "user",
            parts:
              lastMsg.parts as unknown as Database["public"]["Tables"]["ai_messages"]["Insert"]["parts"],
          });

          // Auto-title thread from first user message
          if (thread.title === "New conversation") {
            const text = lastMsg.parts
              .map((p) => (p.type === "text" ? p.text : ""))
              .join(" ")
              .slice(0, 60);
            if (text.trim()) {
              await supabase.from("ai_threads").update({ title: text }).eq("id", threadId);
            }
          }
        }

        // Use NVIDIA NIM provider
        const result = streamText({
          model: nvidia("meta/llama-3.1-70b-instruct"),
          system: systemPrompt,
          messages: await convertToModelMessages(messages),
        });

        return result.toUIMessageStreamResponse({
          originalMessages: messages,
          onFinish: async ({ messages: finalMessages }) => {
            try {
              const assistant = finalMessages[finalMessages.length - 1];
              if (assistant?.role === "assistant") {
                const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
                await supabaseAdmin.from("ai_messages").insert({
                  thread_id: threadId,
                  user_id: userId,
                  role: "assistant",
                  parts:
                    assistant.parts as unknown as Database["public"]["Tables"]["ai_messages"]["Insert"]["parts"],
                });
                await supabaseAdmin
                  .from("ai_threads")
                  .update({ updated_at: new Date().toISOString() })
                  .eq("id", threadId);
              }
            } catch (err) {
              console.error("Error saving assistant message in onFinish:", err);
            }
          },
          onError: (error) => {
            console.error("chat stream error", error);
            return "The assistant is unavailable right now. Please try again in a moment.";
          },
        });
      },
    },
  },
});
