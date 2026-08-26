import { createFileRoute } from "@tanstack/react-router";
import {
  convertToModelMessages,
  streamText,
  tool,
  stepCountIs,
  type UIMessage,
} from "ai";
import { createClient } from "@supabase/supabase-js";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import { getHealthContext, formatHealthContextForAI } from "@/lib/health-context";

type ChatBody = { messages?: UIMessage[]; threadId?: string };

/**
 * Write-action tools. These intentionally have NO `execute` function:
 * the model's tool call is streamed to the frontend as a pending action
 * and only executed via /api/confirm-action after explicit user confirmation.
 */
const logVitalReadingTool = tool({
  description:
    "Log a health vital reading for the user (e.g. blood pressure, glucose, weight, temperature). Requires user confirmation before it is saved.",
  inputSchema: z.object({
    type: z
      .string()
      .describe("Vital kind, e.g. 'bp_systolic', 'bp_diastolic', 'glucose', 'weight', 'temperature'"),
    value: z.number().describe("The numeric reading value"),
    unit: z.string().optional().describe("Unit, e.g. 'mmHg', 'mg/dL', 'kg', '°C'"),
  }),
});

const logMealTool = tool({
  description:
    "Log a meal the user ate (Ghanaian food context). Requires user confirmation before it is saved.",
  inputSchema: z.object({
    food: z.string().describe("The food/dish name, e.g. 'waakye', 'fufu and light soup'"),
    quantity: z.string().optional().describe("Quantity or portion, e.g. '1 plate', '200g'"),
  }),
});

const bookAppointmentTool = tool({
  description:
    "Book a healthcare appointment for the user. Requires user confirmation before it is saved.",
  inputSchema: z.object({
    provider: z.string().describe("Provider or facility name"),
    date: z.string().describe("Appointment date in YYYY-MM-DD format"),
    time: z.string().describe("Appointment time in HH:mm 24-hour format"),
  }),
});

const addMedicationTool = tool({
  description:
    "Add a medication to the user's active medication list. Requires user confirmation before it is saved.",
  inputSchema: z.object({
    name: z.string().describe("Medication name"),
    dosage: z.string().optional().describe("Dosage, e.g. '500mg'"),
    schedule: z.string().optional().describe("Schedule, e.g. 'twice daily', 'every 8 hours'"),
  }),
});

const generateWorkoutPlanTool = tool({
  description:
    "Create a multi-day workout plan tailored to the user's goal. You choose an appropriate duration_days based on the goal (e.g. a quick fitness kickstart might be 7 days, weight loss 14-30 days) and generate the full day-by-day exercise content yourself. Requires user confirmation before anything is saved.",
  inputSchema: z.object({
    title: z.string().describe("Short plan title, e.g. '4-Week Fat Loss Kickstart'"),
    goal: z.string().describe("The user's fitness goal, e.g. 'weight loss'"),
    fitnessLevel: z.enum(["beginner", "intermediate", "advanced"]).describe("User's fitness level"),
    duration_days: z
      .number()
      .int()
      .min(3)
      .max(30)
      .describe("Number of days YOU decide is appropriate for this goal (3-30). One plan day per calendar day."),
    days: z
      .array(
        z.object({
          day_number: z.number().int().min(1),
          exercises: z.array(
            z.object({
              name: z.string(),
              sets: z.number().int().min(1),
              reps: z.string().describe("e.g. '10-12' or '30 seconds'"),
              rest_seconds: z.number().int().min(0),
              notes: z.string().optional(),
            }),
          ),
        }),
      )
      .describe(
        "One entry per day from day_number 1 up to duration_days. Favour exercises needing little or no equipment.",
      ),
  }),
});

const generateMealPlanTool = tool({
  description:
    "Create a multi-day meal plan tailored to the user's goal using authentic Ghanaian foods (waakye, jollof, fufu, banku, kontomire, red red, kelewele, etc.), respecting their allergies and dietary restrictions. You choose an appropriate duration_days based on the goal and generate full day-by-day meal content yourself. Requires user confirmation before anything is saved.",
  inputSchema: z.object({
    title: z.string().describe("Short plan title, e.g. 'Heart-Healthy Ghanaian Meal Plan'"),
    goal: z.string().describe("The user's nutrition goal, e.g. 'weight loss', 'lower blood pressure'"),
    dietaryRestrictions: z
      .string()
      .optional()
      .describe("Allergies or dietary restrictions to respect"),
    duration_days: z
      .number()
      .int()
      .min(3)
      .max(30)
      .describe("Number of days YOU decide is appropriate for this goal (3-30)."),
    days: z
      .array(
        z.object({
          day_number: z.number().int().min(1),
          meals: z.object({
            breakfast: z.string(),
            lunch: z.string(),
            dinner: z.string(),
            snacks: z.string().optional(),
          }),
        }),
      )
      .describe("One entry per day from day_number 1 up to duration_days, using Ghanaian dishes."),
  }),
});

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

ACTIONS & TOOLS:
You can take actions on the user's behalf using tools. Write actions (logVitalReading, logMeal, bookAppointment, addMedication, generateWorkoutPlan, generateMealPlan) are NOT executed immediately — the app shows the user a confirmation card first.
- When you intend a write action, call the matching tool once with complete, correct arguments, then briefly tell the user what you've prepared and that they can confirm or decline it.
- For a blood pressure reading like "130/85", call logVitalReading twice (once for bp_systolic, once for bp_diastolic) with unit mmHg.
- generateWorkoutPlan / generateMealPlan: YOU choose duration_days based on the user's goal (a quick kickstart might be 7 days; weight loss or habit building often suits 14-30 days) and generate ALL days (day_number 1..duration_days) with real content. Use authentic Ghanaian meals for meal plans and simple, minimal-equipment exercises for workout plans. Respect allergies and dietary restrictions from the user context.
- logPlanDayComplete marks a plan day as done immediately (no confirmation needed) — use it when the user says they finished today's workout/meals.
- getActivePlanStatus tells you the user's active plan progress so you can say things like "you're on day 3 of your 7-day plan".
- If the user declines or cancels an action, acknowledge it gracefully and do not re-propose it unless asked.

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

        // ── Tools that execute immediately (read-only + low-friction writes) ──

        const getActivePlanStatusExec = tool({
          description:
            "Get the user's active workout/meal plans and their progress (current day, total days, completed days). Use it in normal conversation to reference plan progress.",
          inputSchema: z.object({}),
          execute: async () => {
            try {
              const [{ data: wPlans }, { data: mPlans }] = await Promise.all([
                supabase
                  .from("workout_plans")
                  .select("id,title,duration_days,start_date,status")
                  .eq("user_id", userId)
                  .eq("status", "active")
                  .order("created_at", { ascending: false })
                  .limit(1),
                supabase
                  .from("meal_plans")
                  .select("id,title,duration_days,start_date,status")
                  .eq("user_id", userId)
                  .eq("status", "active")
                  .order("created_at", { ascending: false })
                  .limit(1),
              ]);

              const summarize = async (
                plan: { id: string; title: string; duration_days: number; start_date: string } | undefined,
                planType: "workout" | "meal",
              ) => {
                if (!plan) return null;
                const start = new Date(plan.start_date + "T00:00:00");
                const today = new Date();
                const dayNumber =
                  Math.min(
                    Math.max(Math.floor((today.getTime() - start.getTime()) / 86400000) + 1, 1),
                    plan.duration_days,
                  );
                const { count } = await supabase
                  .from("plan_day_completions")
                  .select("*", { count: "exact", head: true })
                  .eq("plan_id", plan.id)
                  .eq("plan_type", planType);
                const { data: doneToday } = await supabase
                  .from("plan_day_completions")
                  .select("id")
                  .eq("plan_id", plan.id)
                  .eq("plan_type", planType)
                  .eq("day_number", dayNumber)
                  .maybeSingle();
                return {
                  plan_type: planType,
                  title: plan.title,
                  duration_days: plan.duration_days,
                  current_day: dayNumber,
                  completed_days: count ?? 0,
                  done_today: !!doneToday,
                };
              };

              const [workout, meal] = await Promise.all([
                summarize(wPlans?.[0] as never, "workout"),
                summarize(mPlans?.[0] as never, "meal"),
              ]);
              return { activePlans: [workout, meal].filter(Boolean) };
            } catch (err) {
              console.error("[Chat Tool] getActivePlanStatus failed:", err);
              return { activePlans: [], error: "could_not_load_plans" };
            }
          },
        });

        const logPlanDayCompleteExec = tool({
          description:
            "Mark a specific day of one of the user's active plans as completed. This is low-friction: it executes immediately without a confirmation card.",
          inputSchema: z.object({
            planId: z.string().uuid().describe("ID of the workout or meal plan"),
            dayNumber: z.number().int().min(1).describe("The plan day being marked complete"),
            planType: z.enum(["workout", "meal"]),
          }),
          execute: async ({ planId, dayNumber, planType }) => {
            try {
              // Verify ownership
              const table = planType === "workout" ? "workout_plans" : "meal_plans";
              const { data: plan } = await supabase
                .from(table)
                .select("id,user_id")
                .eq("id", planId)
                .eq("user_id", userId)
                .maybeSingle();
              if (!plan) return { success: false, reason: "plan_not_found" };

              const { error } = await supabase.from("plan_day_completions").upsert({
                plan_id: planId,
                day_number: dayNumber,
                plan_type: planType,
                user_id: userId,
              });
              if (error) throw error;

              await supabase.from("action_logs").insert({
                user_id: userId,
                tool: "logPlanDayComplete",
                args: { planId, dayNumber, planType },
                outcome: "executed",
              });
              console.log(
                `[Action Log] user=${userId} tool=logPlanDayComplete outcome=executed time=${new Date().toISOString()} args=${JSON.stringify({ planId, dayNumber, planType })}`,
              );
              return { success: true };
            } catch (err) {
              console.error("[Chat Tool] logPlanDayComplete failed:", err);
              return { success: false, reason: "write_failed" };
            }
          },
        });

        // Use NVIDIA NIM provider with the agentic tool-calling loop.
        // NOTE: only specific named exports from 'ai' are used anywhere in this file;
        // nothing here touches '@ai-sdk/gateway'.
        const result = streamText({
          model: nvidia("meta/llama-3.1-70b-instruct"),
          system: systemPrompt,
          messages: await convertToModelMessages(messages),
          stopWhen: stepCountIs(8),
          tools: {
            logVitalReading: logVitalReadingTool,
            logMeal: logMealTool,
            bookAppointment: bookAppointmentTool,
            addMedication: addMedicationTool,
            generateWorkoutPlan: generateWorkoutPlanTool,
            generateMealPlan: generateMealPlanTool,
            getActivePlanStatus: getActivePlanStatusExec,
            logPlanDayComplete: logPlanDayCompleteExec,
          },
        });

        return result.toUIMessageStreamResponse({
          originalMessages: messages,
          onFinish: async ({ messages: finalMessages }) => {
            try {
              const assistant = finalMessages[finalMessages.length - 1];
              if (assistant?.role === "assistant") {
                const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

                // Audit-log every proposed write action
                for (const part of assistant.parts) {
                  if (
                    typeof part.type === "string" &&
                    part.type.startsWith("tool-")
                  ) {
                    const toolName = part.type.slice("tool-".length);
                    const WRITE_TOOLS = [
                      "logVitalReading",
                      "logMeal",
                      "bookAppointment",
                      "addMedication",
                      "generateWorkoutPlan",
                      "generateMealPlan",
                    ];
                    if (WRITE_TOOLS.includes(toolName)) {
                      const input =
                        typeof part === "object" && part !== null && "input" in part
                          ? (part as { input?: unknown }).input
                          : {};
                      console.log(
                        `[Action Log] user=${userId} tool=${toolName} outcome=proposed time=${new Date().toISOString()} args=${JSON.stringify(input)}`,
                      );
                      try {
                        await supabaseAdmin.from("action_logs").insert({
                          user_id: userId,
                          tool: toolName,
                          args: (input ?? {}) as never,
                          outcome: "proposed",
                        });
                      } catch {
                        // audit logging must never break chat
                      }
                    }
                  }
                }

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
