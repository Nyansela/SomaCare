import { createFileRoute } from "@tanstack/react-router";
import { generateText } from "ai";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  aiLanguageInstruction,
  isSupportedAiLanguage,
} from "@/lib/ai-language.server";

export const Route = createFileRoute("/api/sleep")({
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

        // AI-generated sleep recommendations are a Plus feature. Gate before
        // doing any model work — the client also checks, but this is the
        // authoritative guard.
        const { hasAccess, TIER_PLUS } = await import("@/lib/subscription.server");
        if (!(await hasAccess(userId, TIER_PLUS))) {
          return Response.json(
            {
              error: "tier_restricted",
              message: "This feature requires SomaCare Plus or higher.",
              feature: "sleep_recommendations",
            },
            { status: 403 },
          );
        }

        // Resolve UI language (client-sent wins, then profile preference)
        const body = (await request.json().catch(() => ({}))) as { language?: string };
        const { data: langProfile } = await supabase
          .from("profiles")
          .select("preferences")
          .eq("id", userId)
          .maybeSingle();
        const langPrefs = (langProfile?.preferences as Record<string, unknown>) || {};
        const userLanguage = isSupportedAiLanguage(body.language)
          ? body.language
          : (langPrefs.language as string) || "en";

        // Fetch recent sleep logs (last 14 days)
        const twoWeeksAgo = new Date();
        twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

        const { data: sleepLogs } = await supabase
          .from("sleep_logs")
          .select("*")
          .eq("user_id", userId)
          .gte("logged_date", twoWeeksAgo.toISOString().split("T")[0])
          .order("logged_date", { ascending: false });

        // Fetch health context for relevant conditions
        const { data: healthVault } = await supabase
          .from("health_vault")
          .select("chronic_conditions, health_goals")
          .eq("user_id", userId)
          .maybeSingle();

        // Calculate sleep statistics
        const sleepStats = calculateSleepStats(sleepLogs || []);



        const chronicConditions = healthVault?.chronic_conditions?.join(", ") || "None";
        const healthGoals = healthVault?.health_goals?.join(", ") || "General wellness";

        const prompt = `You are a sleep optimization assistant tailored for users in Ghana. Based on the user's recent sleep data, climate considerations (warm/humid nights), environmental factors, and health context, provide personalized sleep recommendations.

${aiLanguageInstruction(userLanguage)}

RECENT SLEEP DATA (last 14 days):
${formatSleepData(sleepLogs || [])}

SLEEP STATISTICS:
- Average hours slept: ${sleepStats.avgHours.toFixed(1)} hours
- Average bedtime: ${sleepStats.avgBedtime}
- Average wake time: ${sleepStats.avgWakeTime}
- Sleep consistency score: ${sleepStats.consistencyScore}/10
- Average quality rating: ${sleepStats.avgQuality ? sleepStats.avgQuality.toFixed(1) + "/5" : "Not rated"}

HEALTH CONTEXT:
- Chronic conditions: ${chronicConditions}
- Health goals: ${healthGoals}

Generate a response in this EXACT JSON format (only valid JSON, no other text):

{
  "recommendedBedtime": "string (e.g., 10:30 PM)",
  "recommendedWakeTime": "string (e.g., 6:30 AM)",
  "sleepDuration": "string (e.g., 7-8 hours)",
  "tips": [
    { "title": "string (short title)", "description": "string (2-3 sentences of practical advice)" }
  ],
  "notes": "string (any additional context about their sleep patterns)"
}

IMPORTANT:
- Keep tips concise and practical (2-3 sentences each)
- Consider any chronic conditions that might affect sleep (e.g., sleep apnea, anxiety, chronic pain)
- Factor in their health goals
- Return valid JSON only`;

        const result = await generateText({
          model,
          messages: [{ role: "user", content: prompt }],
        });

        let recommendations: Record<string, unknown>;
        try {
          recommendations = JSON.parse(result.text);
        } catch {
          return Response.json({ error: "Failed to generate recommendations" }, { status: 500 });
        }

        return Response.json({
          recommendations,
          sleepStats,
        });
      },
    },
  },
});

function calculateSleepStats(
  logs: Array<{
    bedtime: string;
    wake_time: string;
    quality_rating: number | null;
    logged_date: string;
  }>,
) {
  if (logs.length === 0) {
    return {
      avgHours: 0,
      avgBedtime: "N/A",
      avgWakeTime: "N/A",
      consistencyScore: 0,
      avgQuality: null,
    };
  }

  // Calculate hours slept for each night
  const hoursSlept = logs.map((log) => {
    const bedtime = new Date(log.bedtime);
    const wakeTime = new Date(log.wake_time);
    let hours = (wakeTime.getTime() - bedtime.getTime()) / (1000 * 60 * 60);
    // Handle overnight sleep (if wake time is before bedtime, assume it's the next day)
    if (hours < 0) {
      hours += 24;
    }
    return hours;
  });

  const avgHours = hoursSlept.reduce((a, b) => a + b, 0) / hoursSlept.length;

  // Calculate average bedtime hour (in minutes from midnight)
  const bedtimes = logs.map((log) => {
    const bedtime = new Date(log.bedtime);
    let minutes = bedtime.getHours() * 60 + bedtime.getMinutes();
    // If bedtime is after midnight (0-6am), add 24 hours worth of minutes
    if (bedtime.getHours() < 12) {
      minutes += 24 * 60;
    }
    return minutes;
  });
  const avgBedtimeMinutes = bedtimes.reduce((a, b) => a + b, 0) / bedtimes.length;
  const avgBedtimeHour = Math.floor(avgBedtimeMinutes / 60) % 24;
  const avgBedtimeMin = Math.floor(avgBedtimeMinutes % 60);
  const avgBedtime = `${avgBedtimeHour.toString().padStart(2, "0")}:${avgBedtimeMin.toString().padStart(2, "0")}`;

  // Calculate average wake time
  const wakeTimes = logs.map((log) => {
    const wakeTime = new Date(log.wake_time);
    return wakeTime.getHours() * 60 + wakeTime.getMinutes();
  });
  const avgWakeMinutes = wakeTimes.reduce((a, b) => a + b, 0) / wakeTimes.length;
  const avgWakeHour = Math.floor(avgWakeMinutes / 60);
  const avgWakeMin = Math.floor(avgWakeMinutes % 60);
  const avgWakeTime = `${avgWakeHour.toString().padStart(2, "0")}:${avgWakeMin.toString().padStart(2, "0")}`;

  // Calculate consistency (standard deviation of bedtimes)
  const bedtimesStd = Math.sqrt(
    bedtimes.reduce((sum, val) => sum + Math.pow(val - avgBedtimeMinutes, 2), 0) / bedtimes.length,
  );
  const consistencyScore = Math.max(0, 10 - Math.round(bedtimesStd / 30)); // 10 if very consistent, less if not

  // Average quality
  const qualityRatings = logs
    .filter((l) => l.quality_rating !== null)
    .map((l) => l.quality_rating!);
  const avgQuality =
    qualityRatings.length > 0
      ? qualityRatings.reduce((a, b) => a + b, 0) / qualityRatings.length
      : null;

  return {
    avgHours,
    avgBedtime,
    avgWakeTime,
    consistencyScore,
    avgQuality,
  };
}

function formatSleepData(
  logs: Array<{
    bedtime: string;
    wake_time: string;
    quality_rating: number | null;
    logged_date: string;
  }>,
) {
  if (logs.length === 0) {
    return "No sleep data available for the past 14 days.";
  }

  return logs
    .map((log) => {
      const bedtime = new Date(log.bedtime);
      const wakeTime = new Date(log.wake_time);
      let hours = (wakeTime.getTime() - bedtime.getTime()) / (1000 * 60 * 60);
      if (hours < 0) hours += 24;

      const date = log.logged_date;
      const time = `${bedtime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} - ${wakeTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
      const quality = log.quality_rating ? `, Quality: ${log.quality_rating}/5` : "";

      return `- ${date}: ${hours.toFixed(1)} hours${quality} (${time})`;
    })
    .join("\n");
}
