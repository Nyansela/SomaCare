import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

/**
 * Executes (or declines) a pending write action proposed by Adwoa in /api/chat.
 * Nothing is ever written to Supabase until the user confirms here.
 */

type ConfirmBody = {
  tool?: string;
  args?: Record<string, unknown>;
  confirmed?: boolean;
};

const argSchemas = {
  logVitalReading: z.object({
    type: z.string().min(1),
    value: z.number(),
    unit: z.string().optional(),
  }),
  logMeal: z.object({
    food: z.string().min(1),
    quantity: z.string().optional(),
  }),
  bookAppointment: z.object({
    provider: z.string().min(1),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    time: z.string().regex(/^\d{2}:\d{2}$/),
  }),
  addMedication: z.object({
    name: z.string().min(1),
    dosage: z.string().optional(),
    schedule: z.string().optional(),
  }),
  generateWorkoutPlan: z.object({
    title: z.string().min(1),
    goal: z.string().min(1),
    fitnessLevel: z.string().min(1),
    duration_days: z.number().int().min(3).max(30),
    days: z
      .array(
        z.object({
          day_number: z.number().int().min(1),
          exercises: z.array(
            z.object({
              name: z.string(),
              sets: z.number().int(),
              reps: z.string(),
              rest_seconds: z.number().int(),
              notes: z.string().optional(),
            }),
          ),
        }),
      )
      .min(1),
  }),
  generateMealPlan: z.object({
    title: z.string().min(1),
    goal: z.string().min(1),
    dietaryRestrictions: z.string().optional(),
    duration_days: z.number().int().min(3).max(30),
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
      .min(1),
  }),
  updatePlan: z.object({
    planId: z.string().uuid(),
    planType: z.enum(["workout", "meal"]),
    title: z.string().min(1).optional(),
    goal: z.string().min(1).optional(),
    duration_days: z.number().int().min(3).max(30).optional(),
    days: z
      .array(
        z.object({
          day_number: z.number().int().min(1),
          exercises: z
            .array(
              z.object({
                name: z.string().min(1),
                sets: z.number().int().min(1),
                reps: z.string().min(1),
                rest_seconds: z.number().int().min(0),
                notes: z.string().optional(),
              }),
            )
            .optional(),
          meals: z
            .object({
              breakfast: z.string().min(1),
              lunch: z.string().min(1),
              dinner: z.string().min(1),
              snacks: z.string().optional(),
            })
            .optional(),
        }),
      )
      .min(1),
  }),
  logSymptom: z.object({
    symptom: z.string().min(1),
    severity: z.enum(["mild", "moderate", "severe"]),
    duration: z.string().optional(),
    bodyArea: z.string().optional(),
    notes: z.string().optional(),
  }),
  completePlan: z.object({
    planId: z.string().uuid(),
    planType: z.enum(["workout", "meal"]),
  }),
} as const;

type ToolName = keyof typeof argSchemas;

export const Route = createFileRoute("/api/confirm-action")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("Authorization") ?? "";
        if (!auth.startsWith("Bearer ")) {
          return new Response("Unauthorized", { status: 401 });
        }
        const token = auth.slice(7);

        let body: ConfirmBody;
        try {
          body = (await request.json()) as ConfirmBody;
        } catch {
          return Response.json({ error: "invalid_json" }, { status: 400 });
        }

        const { tool: toolName, args, confirmed } = body;

        if (!toolName || typeof toolName !== "string") {
          return Response.json({ error: "tool_required" }, { status: 400 });
        }

        // User-scoped client — RLS applies to every write below.
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

        const timestamp = new Date().toISOString();

        // Declined → do nothing, tell the AI it was cancelled next turn.
        if (confirmed !== true) {
          console.log(
            `[Action Log] user=${userId} tool=${toolName} outcome=declined time=${timestamp}`,
          );
          try {
            await supabase.from("action_logs").insert({
              user_id: userId,
              tool: toolName,
              args: (args ?? {}) as never,
              outcome: "declined",
            });
          } catch {
            // audit failure must not break the response
          }
          return Response.json({ status: "cancelled" });
        }

        if (!args || typeof args !== "object") {
          return Response.json({ error: "args_required" }, { status: 400 });
        }

        const schema = argSchemas[toolName as ToolName];
        if (!schema) {
          return Response.json({ error: "unknown_tool", tool: toolName }, { status: 400 });
        }

        const parsed = schema.safeParse(args);
        if (!parsed.success) {
          console.log(
            `[Action Log] user=${userId} tool=${toolName} outcome=failed time=${timestamp} reason=invalid_args`,
          );
          return Response.json(
            { error: "invalid_args", details: parsed.error.issues },
            { status: 400 },
          );
        }
        // The switch below narrows by tool name; flatten the parsed union so
        // each case can access its own schema's fields.
        /* eslint-disable @typescript-eslint/no-explicit-any */
        const validArgs = parsed.data as any;

        try {
          let result: Record<string, unknown>;

          switch (toolName) {
            case "logVitalReading": {
              const { data, error } = await supabase
                .from("vitals")
                .insert({
                  user_id: userId,
                  kind: validArgs.type,
                  value: validArgs.value,
                  unit: validArgs.unit ?? null,
                })
                .select("id")
                .single();
              if (error) throw error;
              result = { id: data.id };
              break;
            }
            case "logMeal": {
              const { data, error } = await supabase
                .from("schedule_items")
                .insert({
                  user_id: userId,
                  title: `Meal: ${validArgs.food}`,
                  description: validArgs.quantity ?? null,
                  item_type: "meal",
                  scheduled_at: new Date().toISOString(),
                  completed: true,
                })
                .select("id")
                .single();
              if (error) throw error;
              result = { id: data.id };
              break;
            }
            case "bookAppointment": {
              const startsAt = `${validArgs.date}T${validArgs.time}:00`;
              const { data, error } = await supabase
                .from("appointments")
                .insert({
                  user_id: userId,
                  provider_name: validArgs.provider,
                  starts_at: new Date(startsAt).toISOString(),
                  mode: "in-person",
                  status: "scheduled",
                })
                .select("id")
                .single();
              if (error) throw error;
              result = { id: data.id };
              break;
            }
            case "addMedication": {
              const { data, error } = await supabase
                .from("medications")
                .insert({
                  user_id: userId,
                  name: validArgs.name,
                  dose: validArgs.dosage ?? null,
                  frequency: validArgs.schedule ?? null,
                  active: true,
                })
                .select("id")
                .single();
              if (error) throw error;
              result = { id: data.id };
              break;
            }
            case "generateWorkoutPlan": {
              // AI-generated plans are Plus-gated. The chat tool also checks,
              // but this is the authoritative write path — never create a plan
              // for a user without access.
              const { hasAccess: hasPlusAccess, TIER_PLUS } =
                await import("@/lib/subscription.server");
              if (!(await hasPlusAccess(userId, TIER_PLUS))) {
                return Response.json(
                  {
                    error: "tier_restricted",
                    message: "This feature requires SomaCare Plus or higher.",
                    feature: "workout_plan_generation",
                  },
                  { status: 403 },
                );
              }
              const { data: plan, error: planErr } = await supabase
                .from("workout_plans")
                .insert({
                  user_id: userId,
                  title: validArgs.title,
                  goal: validArgs.goal,
                  duration_days: validArgs.duration_days,
                  status: "active",
                })
                .select("id")
                .single();
              if (planErr) throw planErr;
              const { error: daysErr } = await supabase.from("workout_plan_days").insert(
                validArgs.days.map((d: { day_number: number; exercises: unknown }) => ({
                  plan_id: plan.id,
                  day_number: d.day_number,
                  exercises: d.exercises as never,
                })),
              );
              if (daysErr) throw daysErr;
              result = { planId: plan.id, days: validArgs.days.length };
              break;
            }
            case "generateMealPlan": {
              // Plus-gated — see generateWorkoutPlan above.
              const { hasAccess: hasPlusAccess, TIER_PLUS } =
                await import("@/lib/subscription.server");
              if (!(await hasPlusAccess(userId, TIER_PLUS))) {
                return Response.json(
                  {
                    error: "tier_restricted",
                    message: "This feature requires SomaCare Plus or higher.",
                    feature: "meal_plan_generation",
                  },
                  { status: 403 },
                );
              }
              const { data: plan, error: planErr } = await supabase
                .from("meal_plans")
                .insert({
                  user_id: userId,
                  title: validArgs.title,
                  goal: validArgs.goal,
                  duration_days: validArgs.duration_days,
                  status: "active",
                })
                .select("id")
                .single();
              if (planErr) throw planErr;
              const { error: daysErr } = await supabase.from("meal_plan_days").insert(
                validArgs.days.map((d: { day_number: number; meals: unknown }) => ({
                  plan_id: plan.id,
                  day_number: d.day_number,
                  meals: d.meals as never,
                })),
              );
              if (daysErr) throw daysErr;
              result = { planId: plan.id, days: validArgs.days.length };
              break;
            }
            case "updatePlan": {
              const table = validArgs.planType === "workout" ? "workout_plans" : "meal_plans";
              const { data: owned } = await supabase
                .from(table)
                .select("id")
                .eq("id", validArgs.planId)
                .eq("user_id", userId)
                .maybeSingle();
              if (!owned) {
                return Response.json({ error: "plan_not_found" }, { status: 404 });
              }

              // Optional plan-level changes (rename / re-goal / extend)
              const planUpdate: Record<string, unknown> = {};
              if (validArgs.title) planUpdate.title = validArgs.title;
              if (validArgs.goal) planUpdate.goal = validArgs.goal;
              if (validArgs.duration_days) planUpdate.duration_days = validArgs.duration_days;
              if (Object.keys(planUpdate).length > 0) {
                const { error: updErr } = await supabase
                  .from(table)
                  .update(planUpdate as never)
                  .eq("id", validArgs.planId);
                if (updErr) throw updErr;
              }

              const daysTable =
                validArgs.planType === "workout" ? "workout_plan_days" : "meal_plan_days";
              // Replace only the requested days, leave every other day untouched
              for (const d of validArgs.days as Array<{ day_number: number }>) {
                await supabase
                  .from(daysTable)
                  .delete()
                  .eq("plan_id", validArgs.planId)
                  .eq("day_number", d.day_number);
              }
              const rows = (validArgs.days as Array<Record<string, unknown>>).map((d) => ({
                plan_id: validArgs.planId as string,
                day_number: d.day_number,
                ...(d.exercises ? { exercises: d.exercises } : {}),
                ...(d.meals ? { meals: d.meals } : {}),
              }));
              const { error: insertErr } = await supabase.from(daysTable).insert(rows as never);
              if (insertErr) throw insertErr;
              result = {
                planId: validArgs.planId,
                updatedDays: (validArgs.days as unknown[]).length,
              };
              break;
            }
            case "logSymptom": {
              const parts = [`Symptom: ${validArgs.symptom}`];
              parts.push(`Severity: ${validArgs.severity}`);
              if (validArgs.duration) parts.push(`Duration: ${validArgs.duration}`);
              if (validArgs.bodyArea) parts.push(`Area: ${validArgs.bodyArea}`);
              const desc = parts.join(" | ");
              const notes = validArgs.notes ? `\n${validArgs.notes}` : "";
              const { data, error } = await supabase
                .from("schedule_items")
                .insert({
                  user_id: userId,
                  title: `Symptom: ${validArgs.symptom}`,
                  description: `${desc}${notes}`,
                  item_type: "symptom",
                  scheduled_at: new Date().toISOString(),
                  completed: false,
                })
                .select("id")
                .single();
              if (error) throw error;
              result = { id: data.id };
              break;
            }
            case "completePlan": {
              const table = validArgs.planType === "workout" ? "workout_plans" : "meal_plans";
              const { error } = await supabase
                .from(table)
                .update({ status: "completed" })
                .eq("id", validArgs.planId)
                .eq("user_id", userId);
              if (error) throw error;
              result = { planId: validArgs.planId };
              break;
            }
            default:
              return Response.json({ error: "unknown_tool" }, { status: 400 });
          }

          console.log(
            `[Action Log] user=${userId} tool=${toolName} outcome=confirmed time=${timestamp}`,
          );
          try {
            await supabase.from("action_logs").insert({
              user_id: userId,
              tool: toolName,
              args: validArgs as never,
              outcome: "confirmed",
            });
          } catch {
            // audit failure must not break the response
          }
          return Response.json({ status: "success", ...result });
        } catch (err) {
          console.error(`[Action Log] user=${userId} tool=${toolName} execute failed:`, err);
          try {
            await supabase.from("action_logs").insert({
              user_id: userId,
              tool: toolName,
              args: validArgs as never,
              outcome: "failed",
            });
          } catch {
            // ignore
          }
          return Response.json({ error: "write_failed" }, { status: 500 });
        }
      },
    },
  },
});
