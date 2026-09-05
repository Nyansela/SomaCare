import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type SynthesizeBody = {
  text?: string;
  language?: string;
};

/**
 * App language codes → ISO 639-3 codes used by the Ghana NLP (Khaya) API.
 * All four use the multilingual "female" speaker so Adwoa always sounds
 * like a Ghanaian woman.
 */
const LANGUAGE_MAP: Record<string, string> = {
  en: "eng", // English
  tw: "twi", // Twi (Akan)
  ee: "ewe", // Ewe
  ga: "gaa", // Ga
};

async function computeHash(text: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const Route = createFileRoute("/api/voice/synthesize")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const timestamp = new Date().toISOString();
        try {
          let body: SynthesizeBody;
          try {
            body = await request.json();
          } catch {
            console.log(`[Voice Log] lang: unknown, cache: n/a, status: 400, time: ${timestamp}`);
            return Response.json({ error: "invalid_json" }, { status: 400 });
          }

          const { text, language } = body;
          const khayaLanguage = language ? LANGUAGE_MAP[language] : undefined;

          if (!language || !khayaLanguage) {
            console.log(
              `[Voice Log] lang: ${language || "unknown"}, cache: n/a, status: 400, time: ${timestamp}`,
            );
            return Response.json(
              { error: "not_yet_supported", language: language || null },
              { status: 400 },
            );
          }

          if (!text || typeof text !== "string" || text.trim().length === 0) {
            console.log(
              `[Voice Log] lang: ${language}, cache: n/a, status: 400, time: ${timestamp}`,
            );
            return Response.json({ error: "text_required" }, { status: 400 });
          }

          const trimmedText = text.trim();
          const textHash = await computeHash(trimmedText);

          const supabaseUrl = process.env.SUPABASE_URL;
          const supabaseKey =
            process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
          const apiKey = process.env.GHANA_NLP_API_KEY;

          if (!supabaseUrl || !supabaseKey) {
            console.log(
              `[Voice Log] lang: ${language}, cache: n/a, status: 500, time: ${timestamp}`,
            );
            return Response.json({ error: "voice_unavailable" }, { status: 500 });
          }

          const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
            auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
          });

          // Check cache
          try {
            const { data: cached } = await supabase
              .from("voice_cache")
              .select("audio_url")
              .eq("text_hash", textHash)
              .eq("language", language)
              .maybeSingle();

            if (cached && cached.audio_url) {
              const audioFetch = await fetch(cached.audio_url);
              if (audioFetch.ok) {
                const audioBuffer = await audioFetch.arrayBuffer();
                console.log(
                  `[Voice Log] lang: ${language}, cache: hit, status: 200, time: ${timestamp}`,
                );
                return new Response(audioBuffer, {
                  headers: {
                    "Content-Type": "audio/wav",
                    "Content-Length": audioBuffer.byteLength.toString(),
                  },
                });
              }
            }
          } catch {
            // Cache check or fetch failed, proceed to Khaya API call
          }

          if (!apiKey) {
            console.log(
              `[Voice Log] lang: ${language}, cache: miss, status: 500, time: ${timestamp}`,
            );
            return Response.json({ error: "voice_unavailable" }, { status: 500 });
          }

          let khayaRes: Response;
          try {
            khayaRes = await fetch("https://translation-api.ghananlp.org/tts/v2/synthesize", {
              method: "POST",
              headers: {
                "Ocp-Apim-Subscription-Key": apiKey,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                text: trimmedText,
                language: khayaLanguage,
                speaker_id: "female",
              }),
            });
          } catch {
            console.log(
              `[Voice Log] lang: ${language}, cache: miss, status: 502, time: ${timestamp}`,
            );
            return Response.json({ error: "voice_unavailable" }, { status: 502 });
          }

          if (!khayaRes.ok) {
            console.log(
              `[Voice Log] lang: ${language}, cache: miss, status: ${khayaRes.status}, time: ${timestamp}`,
            );
            return Response.json({ error: "voice_unavailable" }, { status: 502 });
          }

          const audioBuffer = await khayaRes.arrayBuffer();
          const fileName = `${textHash}_${Date.now()}.wav`;

          // Try uploading to Supabase Storage (if storage bucket exists)
          try {
            const { error: uploadError } = await supabase.storage
              .from("voice-cache")
              .upload(fileName, audioBuffer, {
                contentType: "audio/wav",
                upsert: true,
              });

            if (!uploadError) {
              const { data: publicUrlData } = supabase.storage
                .from("voice-cache")
                .getPublicUrl(fileName);

              if (publicUrlData?.publicUrl) {
                await supabase.from("voice_cache").insert({
                  text_hash: textHash,
                  language,
                  audio_url: publicUrlData.publicUrl,
                });
              }
            }
          } catch {
            // Storage upload / cache insert failure should not prevent returning audio
          }

          console.log(
            `[Voice Log] lang: ${language}, cache: miss, status: 200, time: ${timestamp}`,
          );
          return new Response(audioBuffer, {
            headers: {
              "Content-Type": "audio/wav",
              "Content-Length": audioBuffer.byteLength.toString(),
            },
          });
        } catch (err) {
          console.error("Synthesize error:", err);
          console.log(`[Voice Log] lang: unknown, cache: n/a, status: 500, time: ${timestamp}`);
          return Response.json({ error: "voice_unavailable" }, { status: 500 });
        }
      },
    },
  },
});
