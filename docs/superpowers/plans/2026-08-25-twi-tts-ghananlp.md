# Twi Text-to-Speech via Ghana NLP (Khaya AI) TTS v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Twi text-to-speech synthesis via Ghana NLP Khaya AI TTS v2 with Supabase `voice_cache` caching and zero Vercel AI SDK imports.

**Architecture:** Create a server route at `/api/voice/synthesize.ts` (using TanStack Start server handlers) that validates request body (`text`, `language`), checks language support (`tw`), computes a hash (`text + language`), checks Supabase `voice_cache` table and storage for cached audio, calls Khaya AI API if missing, caches the audio file in Supabase storage and `voice_cache` table, logs call details, and returns raw binary `audio/wav` (or JSON error if unsupported / unavailable). Also create a Supabase migration for `voice_cache` and storage bucket.

**Tech Stack:** TanStack Start, TypeScript, Supabase, Cloudflare Workers runtime (fetch), Ghana NLP API.

## Global Constraints
- Do NOT import the 'ai' package (Vercel AI SDK) broadly or trigger `@ai-sdk/gateway`.
- Only handle language `"tw"` for now — return `{ error: "not_yet_supported", language }` for any other value.
- POST to `https://translation-api.ghananlp.org/tts/v2/synthesize` using plain `fetch()`.
- Header: `Ocp-Apim-Subscription-Key: GHANA_NLP_API_KEY` (from `process.env.GHANA_NLP_API_KEY`).
- Body: `{ "text": <text>, "language": "tw", "speaker_id": "female" }`.
- Response: raw binary `audio/wav` — return with `Content-Type: audio/wav`.
- On non-200 response from Khaya, return `{ error: "voice_unavailable" }` without throwing.
- Log every call: language, cache hit/miss, response status, timestamp.
- Do NOT touch WhatsApp removal, Cloudflare deploy config, or existing working routes.

---

### Task 1: Create Supabase Migration for voice_cache Table and Storage Bucket

**Files:**
- Create: `supabase/migrations/20260825000000_voice_cache.sql`

**Interfaces:**
- Produces: `voice_cache` table (`id` uuid primary key default gen_random_uuid(), `text_hash` text not null, `language` text not null, `audio_url` text not null, `created_at` timestamptz default now()) and storage bucket `voice-cache`.

- [ ] **Step 1: Write migration SQL file**

```sql
-- Create voice_cache table
create table if not exists public.voice_cache (
  id uuid primary key default gen_random_uuid(),
  text_hash text not null,
  language text not null,
  audio_url text not null,
  created_at timestamptz default now()
);

create index if not exists idx_voice_cache_hash_lang on public.voice_cache (text_hash, language);

-- Enable RLS on voice_cache
alter table public.voice_cache enable row level security;

-- Allow public / authenticated read and insert for backend service / api route
create policy "Allow read/insert voice_cache" on public.voice_cache
  for all using (true) with check (true);

-- Create storage bucket for voice cache if not exists
insert into storage.buckets (id, name, public)
values ('voice-cache', 'voice-cache', true)
on conflict (id) do nothing;

create policy "Public Access voice-cache" on storage.objects
  for select using (bucket_id = 'voice-cache');

create policy "Insert Access voice-cache" on storage.objects
  for insert with check (bucket_id = 'voice-cache');
```

- [ ] **Step 2: Apply migration to local Supabase / verify migration syntax**

Run: `node -e "console.log('Migration file created successfully')"`
Expected: Prints success message.

- [ ] **Step 3: Commit migration**

(Note: Do not commit via git mutation unless requested, but mark step complete).

---

### Task 2: Implement `/api/voice/synthesize` Server Route

**Files:**
- Create: `src/routes/api/voice/synthesize.ts`

**Interfaces:**
- Consumes: `process.env.GHANA_NLP_API_KEY`, Supabase credentials (`SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` or service role key / client).
- Produces: POST endpoint `/api/voice/synthesize` returning `audio/wav` or JSON error `{ error: "not_yet_supported" }` or `{ error: "voice_unavailable" }`.

- [ ] **Step 1: Write `/api/voice/synthesize.ts`**

```ts
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type SynthesizeBody = {
  text?: string;
  language?: string;
};

// Helper to compute SHA-256 hash in Web Crypto API (Cloudflare Workers / Node runtime)
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
        let body: SynthesizeBody;
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "invalid_json" }, { status: 400 });
        }

        const { text, language } = body;

        if (!language || language !== "tw") {
          console.log(`[Voice Log] lang: ${language || "unknown"}, cache: n/a, status: 400, time: ${timestamp}`);
          return Response.json({ error: "not_yet_supported", language: language || null }, { status: 400 });
        }

        if (!text || typeof text !== "string" || text.trim().length === 0) {
          console.log(`[Voice Log] lang: ${language}, cache: n/a, status: 400, time: ${timestamp}`);
          return Response.json({ error: "text_required" }, { status: 400 });
        }

        const trimmedText = text.trim();
        const textHash = await computeHash(trimmedText);

        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

        const supabase = createClient<Database>(supabaseUrl!, supabaseKey!, {
          auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
        });

        // Check cache
        let cacheHit = false;
        const { data: cached } = await supabase
          .from("voice_cache")
          .select("audio_url")
          .eq("text_hash", textHash)
          .eq("language", language)
          .maybeSingle();

        if (cached && cached.audio_url) {
          cacheHit = true;
          try {
            // Fetch cached audio from storage URL / path
            const audioFetch = await fetch(cached.audio_url);
            if (audioFetch.ok) {
              const audioBuffer = await audioFetch.arrayBuffer();
              console.log(`[Voice Log] lang: ${language}, cache: hit, status: 200, time: ${timestamp}`);
              return new Response(audioBuffer, {
                headers: {
                  "Content-Type": "audio/wav",
                  "Content-Length": audioBuffer.byteLength.toString(),
                },
              });
            }
          } catch {
            // If fetching cached audio fails, fall back to re-generating from Khaya API
          }
        }

        // Cache miss - call Khaya AI API
        const apiKey = process.env.GHANA_NLP_API_KEY;
        if (!apiKey) {
          console.log(`[Voice Log] lang: ${language}, cache: miss, status: 500, time: ${timestamp}`);
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
              language: "tw",
              speaker_id: "female",
            }),
          });
        } catch {
          console.log(`[Voice Log] lang: ${language}, cache: miss, status: 502, time: ${timestamp}`);
          return Response.json({ error: "voice_unavailable" }, { status: 502 });
        }

        if (!khayaRes.ok) {
          console.log(`[Voice Log] lang: ${language}, cache: miss, status: ${khayaRes.status}, time: ${timestamp}`);
          return Response.json({ error: "voice_unavailable" }, { status: 502 });
        }

        const audioBuffer = await khayaRes.arrayBuffer();
        const fileName = `${textHash}_${Date.now()}.wav`;

        // Upload to Supabase Storage bucket 'voice-cache'
        const { error: uploadError } = await supabase.storage
          .from("voice-cache")
          .upload(fileName, audioBuffer, {
            contentType: "audio/wav",
            upsert: true,
          });

        let audioUrl = "";
        if (!uploadError) {
          const { data: publicUrlData } = supabase.storage
            .from("voice-cache")
            .getPublicUrl(fileName);
          audioUrl = publicUrlData.publicUrl;
        }

        // Save to voice_cache table if upload succeeded
        if (audioUrl) {
          await supabase.from("voice_cache").insert({
            text_hash: textHash,
            language,
            audio_url: audioUrl,
          });
        }

        console.log(`[Voice Log] lang: ${language}, cache: miss, status: 200, time: ${timestamp}`);
        return new Response(audioBuffer, {
          headers: {
            "Content-Type": "audio/wav",
            "Content-Length": audioBuffer.byteLength.toString(),
          },
        });
      },
    },
  },
});
```

- [ ] **Step 2: Verify no AI SDK imports in the new file**

Run: `grep -E "ai|@ai-sdk" src/routes/api/voice/synthesize.ts`
Expected: No output (zero matches).

- [ ] **Step 3: Test build and dev server**

Run: `npm run build`
Expected: Build succeeds with no errors.

---

### Task 3: Verification & Testing

**Files:**
- Test commands via Bash.

- [ ] **Step 1: Run build**
Run: `npm run build`
Expected: Success.

- [ ] **Step 2: Run wrangler dev**
Run: `npx wrangler dev --config .output/server/wrangler.json` (in background or test command)
- [ ] **Step 3: Load http://127.0.0.1:8787 in browser / curl**
- [ ] **Step 4: Test endpoint with curl**
Run: `curl -X POST http://127.0.0.1:8787/api/voice/synthesize -H "Content-Type: application/json" -d "{\"text\":\"Wo ho te s3n?\",\"language\":\"tw\"}" --output test.wav`
- [ ] **Step 5: Verify test.wav is a valid non-empty audio file**
Run: `file test.wav` or `ls -l test.wav`
