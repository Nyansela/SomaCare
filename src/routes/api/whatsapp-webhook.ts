import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { generateText } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { Database } from "@/integrations/supabase/types";
import { getHealthContext, formatHealthContextForAI } from "@/lib/health-context";

export const Route = createFileRoute("/api/whatsapp-webhook")({
  server: {
    handlers: {
      // Simple GET handler so the webhook URL can be verified in a browser
      // and so Twilio's console URL check does not report an error.
      GET: async () => {
        return new Response(
          JSON.stringify({
            ok: true,
            endpoint: "/api/whatsapp-webhook",
            expects: "POST (Twilio webhook)",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      },
      POST: async ({ request }) => {
        try {
          const contentType = request.headers.get("content-type") || "";
          let bodyData: Record<string, string> = {};

          if (contentType.includes("application/x-www-form-urlencoded")) {
            const formData = await request.formData();
            formData.forEach((value, key) => {
              bodyData[key] = value.toString();
            });
          } else {
            try {
              bodyData = await request.json();
            } catch {
              bodyData = {};
            }
          }

          const incomingMessage = (bodyData.Body || "").trim();
          const senderPhone = (bodyData.From || "").trim(); // e.g. "whatsapp:+233241234567"

          if (!senderPhone) {
            return new Response(
              `<Response><Message>Error: Missing sender phone number.</Message></Response>`,
              { status: 400, headers: { "Content-Type": "text/xml" } },
            );
          }

          const supabaseUrl = process.env.SUPABASE_URL;
          const supabaseServiceKey =
            process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;

          if (!supabaseUrl || !supabaseServiceKey) {
            return new Response(
              `<Response><Message>System configuration error. Please try again later.</Message></Response>`,
              { status: 500, headers: { "Content-Type": "text/xml" } },
            );
          }

          const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey, {
            auth: { persistSession: false, autoRefreshToken: false },
          });

          // 1. Check if this phone number is already linked
          const { data: linkRecord } = await supabase
            .from("whatsapp_links")
            .select("user_id, linked_at")
            .eq("phone_number", senderPhone)
            .maybeSingle();

          if (linkRecord && linkRecord.linked_at) {
            // User is linked! Process message with Adwoa AI using getHealthContext()
            const userId = linkRecord.user_id;

            // Fetch health context
            const healthContext = await getHealthContext(
              supabaseUrl,
              supabaseServiceKey,
              userId,
              true,
            );

            // Fetch user language preference
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

            const formattedHealthContext = formatHealthContextForAI(healthContext);

            const systemPrompt = `You are Adwoa, an empathetic, professional AI health companion chatting via WhatsApp.

IMPORTANT CONTEXT ABOUT THE USER:
${formattedHealthContext}

PREFERRED LANGUAGE:
- Respond conversationally in the user's preferred language: ${langName} (${userLanguage}).

Your instructions:
- Assume a Ghanaian user context by default (local foods, common health conditions, metric units).
- Keep responses concise and formatted for WhatsApp (clear paragraphs, bullet points when helpful).
- Always recommend consulting a clinician for diagnosis or medical treatment.
- Never provide emergency medical advice — urge them to call local emergency services if urgent.`;

            const nvidiaApiKey = process.env.NVIDIA_API_KEY;
            let aiReply =
              "Hello! I received your message, but my AI service is currently unconfigured. Please check your API key.";

            if (nvidiaApiKey) {
              const nvidia = createOpenAICompatible({
                name: "nvidia-nim",
                baseURL: "https://integrate.api.nvidia.com/v1",
                headers: { Authorization: `Bearer ${nvidiaApiKey}` },
              });

              try {
                const aiResult = await generateText({
                  model: nvidia("meta/llama-3.1-70b-instruct"),
                  system: systemPrompt,
                  prompt: incomingMessage,
                });
                aiReply = aiResult.text || "I'm here to help with your health questions!";
              } catch (aiErr) {
                console.error("WhatsApp AI generation error:", aiErr);
                aiReply =
                  "Sorry, I encountered an issue processing your health query right now. Please try again soon.";
              }
            }

            return new Response(`<Response><Message>${escapeXml(aiReply)}</Message></Response>`, {
              status: 200,
              headers: { "Content-Type": "text/xml" },
            });
          } else {
            // 2. Not linked yet. Check if incomingMessage matches any pending linking_code
            const { data: pendingLink } = await supabase
              .from("whatsapp_links")
              .select("id, user_id")
              .eq("linking_code", incomingMessage)
              .is("linked_at", null)
              .maybeSingle();

            if (pendingLink) {
              // Link phone number to user
              await supabase
                .from("whatsapp_links")
                .update({
                  phone_number: senderPhone,
                  linked_at: new Date().toISOString(),
                })
                .eq("id", pendingLink.id);

              const successText =
                "Your WhatsApp number has been successfully linked to SomaCare! You can now chat with Adwoa right here.";
              return new Response(
                `<Response><Message>${escapeXml(successText)}</Message></Response>`,
                { status: 200, headers: { "Content-Type": "text/xml" } },
              );
            } else {
              // Not linked and code didn't match
              const instructions =
                "Welcome to SomaCare! Your WhatsApp number is not linked to an account. Please go to SomaCare Settings -> Integrations to get your unique linking code and send it here.";
              return new Response(
                `<Response><Message>${escapeXml(instructions)}</Message></Response>`,
                { status: 200, headers: { "Content-Type": "text/xml" } },
              );
            }
          }
        } catch (err) {
          console.error("WhatsApp webhook error:", err);
          return new Response(
            `<Response><Message>An error occurred processing your request.</Message></Response>`,
            { status: 500, headers: { "Content-Type": "text/xml" } },
          );
        }
      },
    },
  },
});

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
