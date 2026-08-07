# SomaLabsGH — Architecture & Build Plan

An enterprise-grade, mobile-first AI health companion. Built on the Lovable stack (TanStack Start + Lovable Cloud + Lovable AI Gateway) so we get the same capabilities you listed (Postgres, Auth, Storage, Serverless, AI, OAuth) without external accounts, while still matching your architectural intent.

---

## 1. Stack Mapping (your spec → what we'll actually use)

Your spec is written for a Node/Express/Prisma/OpenAI stack. The Lovable stack gives us an equivalent, production-ready backend natively. Nothing is lost — features map 1:1.

| Your spec | Implementation in this project |
|---|---|
| React 19 + Next.js + TS + Tailwind + Framer Motion | React 19 + TanStack Start + TS + Tailwind v4 + Framer Motion |
| Zustand, React Query, React Hook Form, Chart.js | Same (React Query already wired), Recharts for charts |
| Node/Express + Prisma + Postgres + Redis | Supabase (Postgres + RLS + Edge functions). Server logic via `createServerFn` + server routes. Caching via React Query + HTTP cache |
| JWT + refresh + OAuth (Google/Apple) | Supabase Auth (email/pass + Google + Apple, managed sessions) |
| AWS S3 / Cloudinary | Supabase Storage buckets |
| OpenAI (chat, OCR, vision, voice) | AI SDK: Google Gemini 3 Flash (chat + vision + OCR), TTS/STT models |
| Email/SMS/Push | Email via Resend (secret); SMS via Twilio (secret); Web Push |
| Stripe/Paystack/Flutterwave | Stripe native integration; Paystack/Flutterwave via secrets + edge fns |
| Docker/Nginx/Vercel/Railway | Vite + TanStack Start hosting |
| Leaflet/Google Maps + Weather | Leaflet + OpenStreetMap/Overpass for hospitals/pharmacies; Open-Meteo for weather (no key) |

Design language: the reference dashboard (indigo `#7e7fe8`, soft cards, `#edf1fb` canvas, glow shadows, rounded pills) is the north star. We'll extend it with dark mode, glassmorphism accents, and Framer Motion micro-interactions.

---

## 2. Information Architecture / Routes

```text
/                         Landing (hero, AI preview, features, pricing, testimonials, blog, live stats)
/auth                     Sign in / sign up / OAuth / reset
/reset-password           Recovery flow
/_authenticated/          Gate (redirects to /auth)
  /app                    Dashboard (Soma reference layout)
  /assistant              AI Health Assistant (threaded chat)
  /assistant/$threadId
  /records                Medical profile + health records + uploads
  /appointments           Booking, calendar, telemedicine room
  /medications            Meds, reminders, interaction checker, barcode
  /trackers/vitals        BP, HR, SpO2, glucose, weight
  /trackers/nutrition     Meals + AI meal plans
  /trackers/fitness       Workouts + AI plans
  /trackers/sleep         Sleep center + journal
  /trackers/mood          Mood, stress, meditation, crisis resources
  /find/hospitals         Map + list (Leaflet + Overpass)
  /find/pharmacy          Marketplace + cart + orders
  /emergency              SOS, location share, offline pack
  /insights               Analytics, trends, gamification
  /settings               Profile, security (2FA), notifications, privacy, data export
/admin (role: admin)      Users, doctors, hospitals, products, content
/sitemap.xml, /robots.txt
```

Every route ships its own `head()` metadata. `og:image` only on leaf routes with real hero imagery.

---

## 3. Data Model (Postgres via Lovable Cloud)

All tables live in `public`, with `GRANT`s, RLS enabled, and policies scoped to `auth.uid()`. Roles stored separately (`user_roles` + `has_role()` SECURITY DEFINER) to prevent privilege escalation.

Core tables (each has `user_id uuid references auth.users on delete cascade`, `created_at`, `updated_at`):

- `profiles` — display name, DOB, sex, blood type, height, allergies, chronic conditions, emergency contacts (jsonb), locale, avatar
- `user_roles` (`user_id`, `role app_role`) — enum: `user`, `doctor`, `admin`
- `health_records` — type, title, notes, tags, source, `document_id?`
- `documents` — storage path, mime, size, ocr_text, ai_summary
- `medical_images` — storage path, modality, ai_findings jsonb
- `vitals` — kind (bp_sys, bp_dia, hr, spo2, glucose, weight, temp), value, unit, taken_at
- `medications` — name, dose, unit, schedule (jsonb rrule), start/end, notes, barcode
- `medication_logs` — medication_id, taken_at, status
- `appointments` — provider, specialty, starts_at, mode (in_person/tele), status, location, meeting_url
- `providers` — doctors/clinics directory (admin-managed)
- `ai_threads` / `ai_messages` — chat history (parts jsonb), token counts
- `nutrition_entries`, `meal_plans`
- `workouts`, `fitness_plans`
- `sleep_sessions`, `sleep_journal`
- `mood_entries`
- `products`, `product_reviews`, `carts`, `cart_items`, `orders`, `order_items`, `shipments`
- `notifications` — kind, payload, read_at, scheduled_for
- `activity_logs` — audit trail (append-only, admin-readable)
- `achievements`, `user_achievements`
- `settings` — per-user preferences, theme, units, language
- `subscriptions` — stripe_customer_id, plan, status

Indexes on `(user_id, created_at desc)` for every user-scoped list. Composite indexes for calendar range queries.

RLS pattern for every user table:
```sql
create policy "own rows" on public.<t>
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
```
Admin overrides via `public.has_role(auth.uid(), 'admin')`.

---

## 4. Backend Boundaries

- **`createServerFn`** — app-internal RPC: dashboard aggregations, med reminder computation, health score, plan generation, order checkout.
- **Server routes `src/routes/api/*`** — AI chat streaming (`/api/chat`), Stripe webhooks (`/api/public/stripe-webhook`), cron (`/api/public/cron/reminders`), Twilio SMS status.
- **Auth middleware** — `requireSupabaseAuth` on every protected fn. Privileged fns additionally check `has_role`.
- **Admin client** — service-role only inside webhook/admin handlers, dynamically imported.

Secrets (via `add_secret` / `generate_secret`): `RESEND_API_KEY`, `TWILIO_*`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, optional `PAYSTACK_*`, `FLUTTERWAVE_*`. `LOVABLE_API_KEY` is auto-managed.

---

## 5. AI Layer (Lovable AI Gateway)

- **Chat / assistant**: `google/gemini-3-flash-preview` via AI SDK, streamed through `/api/chat` with `toUIMessageStreamResponse`. Threads persisted per user (`ai_threads` + `ai_messages`).
- **Context injection**: system prompt built server-side from the user's profile, active meds, allergies, chronic conditions, recent vitals, and last N summaries. Never trust client-supplied context.
- **Vision / OCR**: same model with image parts for uploaded reports and medical images → structured `Output` (Zod) → stored on `documents.ai_summary` / `medical_images.ai_findings`.
- **Voice**: STT + TTS models from the gateway catalog for voice chat.
- **Emergency detection**: server-side classifier tool on every user message; if triggered, surface SOS banner + crisis resources; never block the response.
- **Tools** (AI SDK `tool()`): `log_vital`, `schedule_reminder`, `find_nearby_hospital`, `summarize_document`. `stopWhen: stepCountIs(50)`.
- **Multilingual**: pass user's `settings.language`; Gemini handles natively.

Chat UI contract: threaded, database-persisted, dedicated `/assistant/$threadId` route, `message.parts` rendering, optimistic send, textarea auto-focus. (Will confirm thread vs single-conversation with user before building the chat surface.)

---

## 6. Feature Modules — Behavior Summary

- **Landing**: real live stats pulled from aggregate counts (users, consultations, meds tracked) — no fabricated numbers. Empty-safe (shows "Join the first cohort" until data exists).
- **Dashboard** (Soma reference layout): Upcoming appointments, Recent results chart (real vitals series), News (admin-managed table), Current prescription (from `medications`), Air-quality/weather alert (Open-Meteo by geolocation), Notifications feed. Every card has a proper empty state.
- **Records**: uploader → Storage → OCR pipeline → searchable list. Signed URLs only.
- **Appointments**: booking against `providers`, calendar view, ICS export, telemedicine room (WebRTC via a lightweight provider or Daily.co — will confirm), reminders via cron.
- **Medications**: RRULE-based schedule, drug-interaction checker (RxNorm/OpenFDA public API), barcode scan via `@zxing/browser`.
- **Trackers**: manual entry + integrations later (Apple Health/Google Fit stubs). Trend charts (Recharts) computed from real rows only.
- **Nutrition/Fitness**: AI-generated plans stored as rows, editable, regeneratable.
- **Sleep / Mood / Meditation**: entries + Lottie guided sessions.
- **Find**: Leaflet map + Overpass API for hospitals/pharmacies around geolocation; ratings/hours from OSM tags when present, otherwise hidden (no fabrication).
- **Marketplace**: real `products` table (admin-seeded via migration), cart, Stripe checkout, order tracking, reviews.
- **Emergency**: SOS button → SMS to emergency contacts with live location; offline pack (Service Worker precache of profile + meds + contacts).
- **Gamification**: achievement triggers on real event streams.
- **Admin**: role-gated CRUD for users, providers, products, news/blog, moderation queue.

---

## 7. Security & Compliance

- RLS on every table + `GRANT`s explicit per role.
- Roles in `user_roles`, never on `profiles`. `has_role()` SECURITY DEFINER.
- 2FA (TOTP) + WebAuthn/biometric via Lovable Cloud Auth.
- HIBP leaked-password check enabled (`configure_auth`).
- Zod validation on every server fn input; input length caps.
- Rate limiting per user on AI + auth endpoints (Cloudflare/edge counters).
- Audit trail (`activity_logs`) for security-relevant events (login, role change, data export, order).
- Signed URLs for all Storage reads; private buckets.
- Data export + delete-account endpoints (GDPR).
- HTTPS enforced by platform. CSP + HSTS headers in root response.
- Webhooks verify signatures (Stripe, Twilio) with `timingSafeEqual`.

---

## 8. Performance & PWA

- SSR loaders via `context.queryClient.ensureQueryData` + `useSuspenseQuery`.
- Skeleton loaders on every list; Suspense boundaries per card.
- Route-level code splitting (TanStack Router default).
- Image optimization: WebP/AVIF via generated assets; `loading="lazy"`.
- Service Worker (Workbox via Vite plugin) — offline shell + runtime cache for GETs + background sync queue for POSTs (vitals, mood, meds logs).
- Web Push (VAPID) for reminders when tab closed; fallback SMS/email via cron.
- Recharts lazy-loaded; Leaflet dynamically imported (client-only).

---

## 9. Design System

Extend `src/styles.css` tokens (oklch). Light + dark:

- `--primary` indigo `#7e7fe8`, `--primary-strong` `#6c6de3`, gradient `--grad-primary`
- Canvas `--background` `#edf1fb` (light) / deep navy (dark); `--card` white / `#1a1a35`
- Success `#16c08f`, danger `#ff7d7d`, info `#758dff`
- Soft shadow tokens: `--shadow-card`, `--shadow-glow-primary`, `--shadow-glow-danger`
- Radii scale already present; add `--radius-pill`
- Typography: Plus Jakarta Sans (display) + Inter (body) via `<link>` in `__root.tsx`
- Motion tokens: `--ease-out-soft`, standard durations 150/250/400ms
- Components: card variants (`glass`, `alert-gradient`), button variants (`hero`, `pill`, `sos`), reusable `<StatCard>`, `<TrendChart>`, `<EmptyState>`, `<AppointmentRow>`, `<PrescriptionRow>`, `<NotificationRow>` matching the reference

No hardcoded colors in components — all via tokens/variants.

---

## 10. Delivery Phases

1. **Foundation**: enable Lovable Cloud, design system, auth (email + Google + Apple), shell layout (sidebar + header matching reference), `_authenticated` gate, roles + `has_role`, settings page.
2. **Dashboard core**: profiles, vitals, medications, appointments schemas + RLS + grants; dashboard cards wired to real queries with empty states.
3. **AI assistant**: threads schema, `/api/chat` streaming route, context builder, `/assistant/$threadId` UI, vision uploads.
4. **Records + documents**: storage, OCR pipeline, signed URLs, list/search.
5. **Trackers**: nutrition/fitness/sleep/mood + AI plan generation.
6. **Find + marketplace**: Leaflet map, Overpass, products/cart/orders, Stripe.
7. **Emergency + PWA**: SOS, offline pack, service worker, push.
8. **Admin + analytics + gamification**.
9. **Hardening**: 2FA, HIBP, audit logs, data export/delete, security scan, sitemap.

---

## 11. Open Questions (I'll confirm before/while building)

1. **Chat storage & shape**: threaded chats with database persistence per your spec — confirm? (Required before building the assistant UI.)
2. **Telemedicine provider**: WebRTC via Daily.co (needs API key) vs simple LiveKit vs deferred to phase 2?
3. **Payments scope for v1**: Stripe only, or also Paystack + Flutterwave now?
4. **Which phase should I actually build first this turn?** Recommendation: Phase 1 + the dashboard shell matching your reference, so you can see the product take shape immediately.

Approve this plan (and answer Q4) and I'll start with Phase 1.
