import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, tool, stepCountIs, type UIMessage } from "ai";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import { getHealthContext, formatHealthContextForAI } from "@/lib/health-context";
import { getDrugLabel } from "@/lib/openfda.server";
import {
  aiLanguageInstruction,
  aiLanguageName,
  isSupportedAiLanguage,
} from "@/lib/ai-language.server";

type ChatBody = { messages?: UIMessage[]; threadId?: string; language?: string };

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
      .describe(
        "Vital kind, e.g. 'bp_systolic', 'bp_diastolic', 'glucose', 'weight', 'temperature'",
      ),
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

function createWorkoutPlanTool(userId: string) {
  return tool({
    description:
      "Create a multi-day workout plan tailored to the user's goal. You choose an appropriate duration_days based on the goal (e.g. a quick fitness kickstart might be 7 days, weight loss 14-30 days) and generate the full day-by-day exercise content yourself. Requires user confirmation before anything is saved.",
    inputSchema: z.object({
      title: z.string().describe("Short plan title, e.g. '4-Week Fat Loss Kickstart'"),
      goal: z.string().describe("The user's fitness goal, e.g. 'weight loss'"),
      fitnessLevel: z
        .enum(["beginner", "intermediate", "advanced"])
        .describe("User's fitness level"),
      duration_days: z
        .number()
        .int()
        .min(3)
        .max(30)
        .describe(
          "Number of days YOU decide is appropriate for this goal (3-30). One plan day per calendar day.",
        ),
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
    execute: async () => {
      // AI-generated workout plans are a Plus feature. When access is denied,
      // report back to the model (as a tool result) so it can explain the
      // restriction naturally instead of proposing a plan that will never be
      // created.
      const { hasAccess, TIER_PLUS } = await import("@/lib/subscription.server");
      const allowed = await hasAccess(userId, TIER_PLUS);
      if (!allowed) {
        return {
          error: "tier_restricted",
          message: "This feature requires SomaCare Plus or higher.",
          feature: "workout_plan_generation",
        };
      }
      // Access granted: the plan is only written after the user confirms the
      // action card (see /api/confirm-action), so signal that to the model
      // rather than claiming the plan was created.
      return { status: "awaiting_user_confirmation" };
    },
  });
}

function createMealPlanTool(userId: string) {
  return tool({
    description:
      "Create a multi-day meal plan tailored to the user's goal using authentic Ghanaian foods (waakye, jollof, fufu, banku, kontomire, red red, kelewele, etc.), respecting their allergies and dietary restrictions. You choose an appropriate duration_days based on the goal and generate full day-by-day meal content yourself. Requires user confirmation before anything is saved.",
    inputSchema: z.object({
      title: z.string().describe("Short plan title, e.g. 'Heart-Healthy Ghanaian Meal Plan'"),
      goal: z
        .string()
        .describe("The user's nutrition goal, e.g. 'weight loss', 'lower blood pressure'"),
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
        .describe(
          "One entry per day from day_number 1 up to duration_days, using Ghanaian dishes.",
        ),
    }),
    execute: async () => {
      // AI-generated meal plans are a Plus feature — see createWorkoutPlanTool.
      const { hasAccess, TIER_PLUS } = await import("@/lib/subscription.server");
      const allowed = await hasAccess(userId, TIER_PLUS);
      if (!allowed) {
        return {
          error: "tier_restricted",
          message: "This feature requires SomaCare Plus or higher.",
          feature: "meal_plan_generation",
        };
      }
      return { status: "awaiting_user_confirmation" };
    },
  });
}

/**
 * Confirmed-write: adapt an existing ACTIVE plan — rename, change goal,
 * extend duration and/or rewrite specific days (swap exercises/meals).
 */
const updatePlanTool = tool({
  description:
    "Modify one of the user's ACTIVE workout or meal plans: rename it, change its goal, extend its duration, and/or rewrite specific days (easier/harder exercises, different Ghanaian meals). Call getPlanDetails first to see the current content. Requires user confirmation before anything is saved.",
  inputSchema: z.object({
    planId: z
      .string()
      .uuid()
      .describe("ID of the plan being changed (from getActivePlanStatus or getPlanDetails)"),
    planType: z.enum(["workout", "meal"]),
    title: z.string().optional().describe("New plan title"),
    goal: z.string().optional().describe("New goal, e.g. 'build endurance'"),
    duration_days: z.number().int().min(3).max(30).optional(),
    days: z
      .array(
        z.object({
          day_number: z.number().int().min(1),
          exercises: z
            .array(
              z.object({
                name: z.string(),
                sets: z.number().int().min(1),
                reps: z.string(),
                rest_seconds: z.number().int().min(0),
                notes: z.string().optional(),
              }),
            )
            .optional()
            .describe("The replacement exercises — required for workout plans"),
          meals: z
            .object({
              breakfast: z.string(),
              lunch: z.string(),
              dinner: z.string(),
              snacks: z.string().optional(),
            })
            .optional()
            .describe("The replacement meals — required for meal plans"),
        }),
      )
      .min(1)
      .describe("Only the days listed here are rewritten; all other days stay untouched."),
  }),
});

/** Confirmed-write: mark a whole plan as completed when the user finishes it. */
const completePlanTool = tool({
  description:
    "Mark one of the user's ACTIVE workout or meal plans as completed. Use it when the user says they finished their plan — celebrate their consistency first, then propose this. Requires user confirmation.",
  inputSchema: z.object({
    planId: z.string().uuid().describe("ID of the completed plan"),
    planType: z.enum(["workout", "meal"]),
  }),
});

/** Confirmed-write: log a symptom the user is experiencing. */
const logSymptomTool = tool({
  description:
    "Log a symptom the user is experiencing (e.g. headache, chest pain, nausea, fatigue). Requires user confirmation before it is saved. Always ask clarifying questions first if the symptom seems serious.",
  inputSchema: z.object({
    symptom: z.string().describe("The symptom, e.g. 'headache', 'chest tightness', 'stomach pain'"),
    severity: z.enum(["mild", "moderate", "severe"]).describe("How severe the symptom is"),
    duration: z
      .string()
      .optional()
      .describe("How long they've had it, e.g. '2 days', 'since morning', '3 hours'"),
    bodyArea: z
      .string()
      .optional()
      .describe("Body area affected, e.g. 'head', 'chest', 'abdomen', 'left knee'"),
    notes: z
      .string()
      .optional()
      .describe("Any additional context — what they were doing, what makes it better/worse, etc."),
  }),
});

/** Read-only: search the user's health history by type and date range. */
const searchHealthHistoryTool = tool({
  description:
    "Search the user's health records — vitals, medications, appointments, or symptoms — by type and optional date range. Use it when the user asks about their past health data (e.g. 'what was my BP last week?', 'show my glucose readings from March'). Executes immediately (read-only).",
  inputSchema: z.object({
    queryType: z
      .enum(["vitals", "medications", "appointments", "symptoms"])
      .describe("What type of health data to search"),
    vitalKind: z
      .string()
      .optional()
      .describe("For vitals: filter by kind, e.g. 'bp_systolic', 'glucose', 'weight'"),
    dateFrom: z.string().optional().describe("Start date (YYYY-MM-DD). Defaults to 30 days ago."),
    dateTo: z.string().optional().describe("End date (YYYY-MM-DD). Defaults to today."),
    limit: z
      .number()
      .int()
      .min(1)
      .max(50)
      .optional()
      .describe("Max results to return (default 20)"),
  }),
});

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const auth = request.headers.get("Authorization") ?? "";
          if (!auth.startsWith("Bearer ")) {
            return new Response("Unauthorized", { status: 401 });
          }
          const token = auth.slice(7);

          // Create AI model via the multi-provider gateway (NVIDIA → Gemini → Lovable fallback)
          const { createAiModel, AI_NOT_CONFIGURED_MESSAGE } =
            await import("@/lib/ai-gateway.server");
          let aiModel;
          try {
            aiModel = createAiModel();
          } catch {
            console.error("[chat]", AI_NOT_CONFIGURED_MESSAGE);
            return new Response(AI_NOT_CONFIGURED_MESSAGE, { status: 500 });
          }
          console.log("[chat] using model:", aiModel.modelId, "provider:", aiModel.provider);

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
          const { messages, threadId, language: uiLanguage } = body;
          if (!Array.isArray(messages) || !threadId) {
            return new Response("Bad request", { status: 400 });
          }

          // ── Free-tier AI usage limit ─────────────────────────────────
          // Atomically roll the 30-day period over, count this request and
          // report whether the free allowance is exceeded (paid tiers and
          // bypass accounts are unlimited). Counting here — before generation —
          // means an aborted/errored stream still consumes its allowance, which
          // matches what the user actually saw.
          try {
            const { data: usage } = await supabase.rpc("consume_ai_usage", {
              p_user_id: userId,
            });
            const usageRow = usage?.[0];
            if (usageRow?.over_limit) {
              return Response.json(
                {
                  error: "usage_limit_reached",
                  message: `You've used your ${usageRow.monthly_limit ?? 0} free AI messages this month. Upgrade to SomaCare Plus for unlimited conversations.`,
                  used: usageRow.used,
                  limit: usageRow.monthly_limit,
                },
                { status: 429 },
              );
            }
          } catch (err) {
            // Usage tracking must never break chat — if the RPC fails (e.g.
            // the migration hasn't been applied), serve the request normally.
            console.error("[chat] consume_ai_usage failed:", err);
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
          // The language the user has the UI in right now wins; fall back to the
          // persisted profile preference so the reply matches what's on screen.
          const userLanguage = isSupportedAiLanguage(uiLanguage)
            ? uiLanguage
            : (userPrefs.language as string) || "en";
          const langName = aiLanguageName(userLanguage);

          // Format health context for AI
          const formattedHealthContext = formatHealthContextForAI(healthContext);

          const systemPrompt = `You are Adwoa, an empathetic, professional AI health companion.

IMPORTANT CONTEXT ABOUT THE USER:
${formattedHealthContext}

${aiLanguageInstruction(userLanguage)}

Your instructions:
- Assume a Ghanaian user context by default — local foods, common local health conditions/context (e.g., malaria awareness, hypertension, type 2 diabetes management), metric units (kg, cm, °C), awareness of local healthcare facilities (CHPS compounds, polyclinics, teaching hospitals), and respect for common local remedies/herbal practices (mentioned respectfully alongside medical advice, never replacing it).
- Use this health context naturally in your responses - for example, if the user asks about food, suggest authentic Ghanaian dishes (waakye, jollof, fufu, banku, etc.) and be aware of their allergies
- Do NOT repeat the user's health data back to them unless specifically relevant to the question
- Always recommend consulting a qualified clinician for diagnosis, treatment, or anything serious
- Never provide emergency medical advice - instead urge them to call emergency services
- If you're uncertain about something, say so honestly
- Provide clear, evidence-informed guidance

AGENTIC BEHAVIOR — BE PROACTIVE:
- When a user logs a vital reading, check it against their normal range and medications. If abnormal, suggest next steps (e.g. "Your BP is higher than usual — would you like me to check your medication interactions or book a doctor visit?").
- When the user mentions symptoms, ask clarifying questions (severity, duration, what makes it better/worse) BEFORE logging. For severe symptoms (chest pain, difficulty breathing, severe bleeding, high fever >39°C), immediately advise seeking emergency care.
- Use searchHealthHistory to pull relevant past data when answering health questions — don't guess when you can look it up.
- Chain tools intelligently: if a user logs a high BP reading, you can (1) log it, (2) check drug interactions with their current meds, (3) suggest booking a follow-up — all in one response.
- Reference plan progress naturally: "You're on day 5 of your 7-day plan — just 2 more days!" Don't wait to be asked.
- If a user hasn't logged vitals in a while, gently remind them: "I noticed you haven't logged your BP this week — want to log it now?"

ACTIONS & TOOLS:
Write actions (logVitalReading, logMeal, logSymptom, bookAppointment, addMedication, generateWorkoutPlan, generateMealPlan, updatePlan, completePlan) require user confirmation — the app shows a confirmation card first.
Read-only tools (getActivePlanStatus, getPlanDetails, checkDrugInteractionWarnings, searchHealthHistory) execute immediately.
Low-friction writes (logPlanDayComplete, logWaterIntake) execute immediately without confirmation.

- When you intend a write action, call the matching tool once with complete, correct arguments, then briefly tell the user what you've prepared and that they can confirm or decline it.
- For a blood pressure reading like "130/85", call logVitalReading twice (once for bp_systolic, once for bp_diastolic) with unit mmHg.
- logSymptom: When the user describes a symptom, ask about severity and duration first, then propose logging it. This helps track health patterns over time.
- logWaterIntake: Use this when the user mentions drinking water ("I just drank a glass of water", "had 500ml"). Log it immediately without asking for confirmation.
- searchHealthHistory: Use this when the user asks about past health data ("what was my BP last week?", "show my glucose readings", "when is my next appointment?"). Don't guess — look it up.
- generateWorkoutPlan / generateMealPlan: YOU choose duration_days based on the user's goal (a quick kickstart might be 7 days; weight loss or habit building often suits 14-30 days) and generate ALL days (day_number 1..duration_days) with real content. Use authentic Ghanaian meals for meal plans and simple, minimal-equipment exercises for workout plans. Respect allergies and dietary restrictions from the user context.
- getActivePlanStatus tells you every active plan's progress (current day, completed days, done-today flags, recently completed days) so you can proactively reference streaks.
- getPlanDetails returns one active plan's full detail for any day (default today) including its exercises or meals — ALWAYS call it before changing a plan, and use it to walk the user through today's workout or meals when they ask.
- updatePlan rewrites specific days of an active plan WITHOUT touching other days. When the user struggles — "too hard", "no equipment", "knee pain", "bored of these meals", "travelling this week" — fetch the details, design better replacement days yourself, and propose the change with ONE updatePlan call.
- completePlan marks an entire plan as completed when the user finishes it. Celebrate their consistency FIRST, then propose completing it.
- logPlanDayComplete marks a plan day as done immediately (no confirmation needed) — use it when the user says they finished today's workout/meals.
- Be proactive about plans in normal conversation: mention today's workout or meals when relevant, congratulate streaks, and offer to adapt the plan when the user mentions soreness, missed days, travel, or schedule changes.
- If the user declines or cancels an action, acknowledge it gracefully and do not re-propose it unless asked.

Style: warm, concise, structured with short paragraphs and bullet lists where helpful. Use markdown.`;

          // Message persistence happens client-side now (src/lib/use-chat.ts):
          // the client writes each user + assistant message to ai_messages as it
          // is sent/streamed, so nothing is lost when a stream is aborted or the
          // user navigates away (server-side onFinish does not run for aborted
          // streams) and messages can never be written twice.

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
                  plan:
                    | { id: string; title: string; duration_days: number; start_date: string }
                    | undefined,
                  planType: "workout" | "meal",
                ) => {
                  if (!plan) return null;
                  const start = new Date(plan.start_date + "T00:00:00");
                  const today = new Date();
                  const dayNumber = Math.min(
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
                  const { data: recent } = await supabase
                    .from("plan_day_completions")
                    .select("day_number")
                    .eq("plan_id", plan.id)
                    .eq("plan_type", planType)
                    .order("day_number", { ascending: false })
                    .limit(14);
                  return {
                    plan_type: planType,
                    id: plan.id,
                    title: plan.title,
                    duration_days: plan.duration_days,
                    current_day: dayNumber,
                    completed_days: count ?? 0,
                    done_today: !!doneToday,
                    recent_completed_days: (recent ?? []).map((r) => r.day_number),
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

          const getPlanDetailsExec = tool({
            description:
              "Get the user's most recent ACTIVE workout or meal plan, including the exercises or meals for a specific day (defaults to today) and whether that day is completed. Always call it before proposing updatePlan changes, and use it to coach the user through a day.",
            inputSchema: z.object({
              planType: z.enum(["workout", "meal"]),
              dayNumber: z.number().int().min(1).max(30).optional(),
            }),
            execute: async ({ planType, dayNumber }) => {
              try {
                const table = planType === "workout" ? "workout_plans" : "meal_plans";
                const daysTable = planType === "workout" ? "workout_plan_days" : "meal_plan_days";
                const { data: plans } = await supabase
                  .from(table)
                  .select("id,title,goal,duration_days,start_date")
                  .eq("user_id", userId)
                  .eq("status", "active")
                  .order("created_at", { ascending: false })
                  .limit(1);
                const plan = plans?.[0] as
                  | {
                      id: string;
                      title: string;
                      goal: string;
                      duration_days: number;
                      start_date: string;
                    }
                  | undefined;
                if (!plan) return { found: false, reason: "no_active_plan" };

                const start = new Date(plan.start_date + "T00:00:00");
                const today = Math.min(
                  Math.max(Math.floor((Date.now() - start.getTime()) / 86400000) + 1, 1),
                  plan.duration_days,
                );
                const day = Math.min(dayNumber ?? today, plan.duration_days);

                const [dayRes, countRes, doneRes] = await Promise.all([
                  supabase
                    .from(daysTable)
                    .select("*")
                    .eq("plan_id", plan.id)
                    .eq("day_number", day)
                    .maybeSingle(),
                  supabase
                    .from("plan_day_completions")
                    .select("*", { count: "exact", head: true })
                    .eq("plan_id", plan.id)
                    .eq("plan_type", planType),
                  supabase
                    .from("plan_day_completions")
                    .select("id")
                    .eq("plan_id", plan.id)
                    .eq("plan_type", planType)
                    .eq("day_number", day)
                    .maybeSingle(),
                ]);

                const dayData = (dayRes.data ?? null) as {
                  exercises?: unknown;
                  meals?: unknown;
                } | null;

                return {
                  found: true,
                  plan_type: planType,
                  id: plan.id,
                  title: plan.title,
                  goal: plan.goal,
                  duration_days: plan.duration_days,
                  current_day: today,
                  requested_day: day,
                  completed_days: countRes.count ?? 0,
                  requested_day_completed: !!doneRes.data,
                  exercises:
                    planType === "workout"
                      ? ((dayData?.exercises as Array<Record<string, unknown>> | null) ?? [])
                      : undefined,
                  meals:
                    planType === "meal"
                      ? ((dayData?.meals as Record<string, string> | null) ?? {})
                      : undefined,
                };
              } catch (err) {
                console.error("[Chat Tool] getPlanDetails failed:", err);
                return { found: false, reason: "lookup_failed" };
              }
            },
          });

          const checkDrugInteractionWarningsExec = tool({
            description:
              "Check openFDA drug labels and interaction warnings for a list of medications the user is taking. Executes immediately (read-only).",
            inputSchema: z.object({
              medicationNames: z.array(z.string()).describe("List of medication names to check"),
            }),
            execute: async ({ medicationNames }) => {
              if (!medicationNames || medicationNames.length === 0) {
                return { status: "no_medications_provided" };
              }
              try {
                const results = await Promise.all(
                  medicationNames.map((name) => getDrugLabel(name)),
                );
                return {
                  results: results.map((r) => ({
                    medication: r.drugName,
                    warnings: r.warnings?.slice(0, 2) || [],
                    interactions: r.drugInteractions?.slice(0, 2) || [],
                    status: r.error || "success",
                  })),
                  disclaimer:
                    "Information sourced from openFDA. Consult a qualified clinician or pharmacist for medical advice.",
                };
              } catch (err) {
                return { status: "interaction_check_unavailable", details: String(err) };
              }
            },
          });

          // ── Water intake logging (low-friction, instant) ───────────
          const logWaterIntakeExec = tool({
            description:
              "Log water intake for the user. Executes immediately without confirmation — it's low-friction like logPlanDayComplete.",
            inputSchema: z.object({
              amountMl: z
                .number()
                .int()
                .min(50)
                .max(5000)
                .describe("Amount of water in milliliters"),
            }),
            execute: async ({ amountMl }) => {
              try {
                const { error } = await supabase.from("hydration_logs").insert({
                  user_id: userId,
                  amount_ml: amountMl,
                  logged_at: new Date().toISOString(),
                });
                if (error) throw error;
                await supabase.from("action_logs").insert({
                  user_id: userId,
                  tool: "logWaterIntake",
                  args: { amountMl },
                  outcome: "executed",
                });
                return { success: true, amountMl };
              } catch (err) {
                console.error("[Chat Tool] logWaterIntake failed:", err);
                return { success: false, reason: "write_failed" };
              }
            },
          });

          // ── Symptom logging (confirmed-write) ──────────────────────
          const logSymptomExec = tool({
            description: logSymptomTool.description,
            inputSchema: logSymptomTool.inputSchema,
          });

          // ── Health history search (read-only, instant) ──────────────
          const searchHealthHistoryExec = tool({
            description: searchHealthHistoryTool.description,
            inputSchema: searchHealthHistoryTool.inputSchema,
            execute: async ({ queryType, vitalKind, dateFrom, dateTo, limit }) => {
              try {
                const maxResults = limit ?? 20;
                const to = dateTo ?? new Date().toISOString().split("T")[0];
                const from =
                  dateFrom ??
                  (() => {
                    const d = new Date();
                    d.setDate(d.getDate() - 30);
                    return d.toISOString().split("T")[0];
                  })();

                switch (queryType) {
                  case "vitals": {
                    let query = supabase
                      .from("vitals")
                      .select("kind, value, unit, taken_at")
                      .eq("user_id", userId)
                      .gte("taken_at", `${from}T00:00:00`)
                      .lte("taken_at", `${to}T23:59:59`)
                      .order("taken_at", { ascending: false })
                      .limit(maxResults);
                    if (vitalKind) query = query.eq("kind", vitalKind);
                    const { data, error } = await query;
                    if (error) throw error;
                    return { queryType, results: data ?? [], count: data?.length ?? 0 };
                  }
                  case "medications": {
                    const { data, error } = await supabase
                      .from("medications")
                      .select("name, dose, frequency, active, created_at")
                      .eq("user_id", userId)
                      .order("created_at", { ascending: false })
                      .limit(maxResults);
                    if (error) throw error;
                    return { queryType, results: data ?? [], count: data?.length ?? 0 };
                  }
                  case "appointments": {
                    const { data, error } = await supabase
                      .from("appointments")
                      .select("provider_name, specialty, starts_at, status")
                      .eq("user_id", userId)
                      .gte("starts_at", `${from}T00:00:00`)
                      .lte("starts_at", `${to}T23:59:59`)
                      .order("starts_at", { ascending: false })
                      .limit(maxResults);
                    if (error) throw error;
                    return { queryType, results: data ?? [], count: data?.length ?? 0 };
                  }
                  case "symptoms": {
                    const { data, error } = await supabase
                      .from("schedule_items")
                      .select("title, description, scheduled_at, completed")
                      .eq("user_id", userId)
                      .eq("item_type", "symptom")
                      .gte("scheduled_at", `${from}T00:00:00`)
                      .lte("scheduled_at", `${to}T23:59:59`)
                      .order("scheduled_at", { ascending: false })
                      .limit(maxResults);
                    if (error) throw error;
                    return { queryType, results: data ?? [], count: data?.length ?? 0 };
                  }
                  default:
                    return { queryType, results: [], count: 0, error: "unknown_query_type" };
                }
              } catch (err) {
                console.error("[Chat Tool] searchHealthHistory failed:", err);
                return { queryType, results: [], count: 0, error: "search_failed" };
              }
            },
          });

          // Use the AI gateway model with the agentic tool-calling loop.
          // Plan-generation tools are created per-request so their execute can
          // run the Plus tier check for THIS user.
          const generateWorkoutPlanTool = createWorkoutPlanTool(userId);
          const generateMealPlanTool = createMealPlanTool(userId);

          const result = streamText({
            model: aiModel,
            system: systemPrompt,
            messages: await convertToModelMessages(messages),
            stopWhen: stepCountIs(12),
            tools: {
              logVitalReading: logVitalReadingTool,
              logMeal: logMealTool,
              bookAppointment: bookAppointmentTool,
              addMedication: addMedicationTool,
              logSymptom: logSymptomExec,
              generateWorkoutPlan: generateWorkoutPlanTool,
              generateMealPlan: generateMealPlanTool,
              getActivePlanStatus: getActivePlanStatusExec,
              getPlanDetails: getPlanDetailsExec,
              logPlanDayComplete: logPlanDayCompleteExec,
              updatePlan: updatePlanTool,
              completePlan: completePlanTool,
              logWaterIntake: logWaterIntakeExec,
              checkDrugInteractionWarnings: checkDrugInteractionWarningsExec,
              searchHealthHistory: searchHealthHistoryExec,
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
                    if (typeof part.type === "string" && part.type.startsWith("tool-")) {
                      const toolName = part.type.slice("tool-".length);
                      const WRITE_TOOLS = [
                        "logVitalReading",
                        "logMeal",
                        "bookAppointment",
                        "addMedication",
                        "logSymptom",
                        "generateWorkoutPlan",
                        "generateMealPlan",
                        "updatePlan",
                        "completePlan",
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

                  // The assistant message itself is persisted client-side (see
                  // src/lib/use-chat.ts). onFinish does not run when the client
                  // aborts the stream, so writing here would lose aborted replies
                  // and duplicate completed ones.
                }
              } catch (err) {
                console.error("Error in chat onFinish:", err);
              }
            },
            onError: (error) => {
              const err = error as Error & { cause?: unknown };
              console.error("[chat] stream error:", error);
              console.error("[chat] error name:", err.name);
              console.error("[chat] error message:", err.message);
              if (err.cause) console.error("[chat] error cause:", err.cause);
              return "The assistant is unavailable right now. Please try again in a moment.";
            },
          });
        } catch (err) {
          console.error("[chat] FATAL handler error:", err);
          console.error("[chat] stack:", (err as Error).stack);
          return new Response(`Internal error: ${(err as Error).message}`, { status: 500 });
        }
      },
    },
  },
});
