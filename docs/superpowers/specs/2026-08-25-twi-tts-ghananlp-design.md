# Twi Text-to-Speech via Ghana NLP (Khaya AI) TTS v2 - Design Spec

## Overview
Implement Twi text-to-speech synthesis endpoint at `/api/voice/synthesize` using Ghana NLP (Khaya AI) TTS v2 API via plain `fetch()`, with Supabase `voice_cache` table caching and Supabase storage (or URL) caching for `.wav` audio files.

## Requirements & Constraints
1. **Endpoint**: `POST /api/voice/synthesize` accepting JSON `{ text, language }`.
2. **Language Validation**: Only handle language `"tw"` for now. For any other language value, return JSON `{ error: "not_yet_supported", language }`.
3. **Khaya AI API Integration**:
   - URL: `https://translation-api.ghananlp.org/tts/v2/synthesize`
   - Method: `POST`
   - Headers: `Ocp-Apim-Subscription-Key: <GHANA_NLP_API_KEY>`, `Content-Type: application/json`
   - Body: `{ "text": text, "language": "tw", "speaker_id": "female" }`
   - Response: Raw binary audio/wav. Return with `Content-Type: audio/wav`.
4. **Caching Strategy**:
   - Compute hash of `text + language` (e.g., using Web Crypto API `crypto.subtle.digest("SHA-256", ...)` or simple SHA-256 / SHA-1 / MD5 hash compatible with Cloudflare Workers).
   - Check Supabase table `voice_cache` (`id`, `text_hash`, `language`, `audio_url` or storage path, `created_at`).
   - On cache hit: Retrieve audio from Supabase storage or URL and return with `Content-Type: audio/wav`.
   - On cache miss: Call Khaya API, store resulting audio binary in Supabase storage bucket (`voice-cache`), insert cache record into `voice_cache`, and return audio with `Content-Type: audio/wav`.
   - Migration: Create `voice_cache` table and `voice-cache` storage bucket if they do not exist.
5. **Error Handling**:
   - On any non-200 response from Khaya API, return `{ error: "voice_unavailable" }` (JSON response) without throwing.
6. **Logging**:
   - Log every call: language, cache hit/miss, response status, timestamp.
7. **Constraints**:
   - Do NOT import `'ai'` package (Vercel AI SDK) or trigger `@ai-sdk/gateway`.
   - Do NOT touch WhatsApp removal, Cloudflare deploy config, or existing working routes.
