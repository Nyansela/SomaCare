# Alarm Priority Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an "alarm priority" mode for critical medication reminders using `@capacitor/local-notifications` with high importance/priority channels, distinct alarm sound configuration, and a Settings toggle.

**Architecture:** Update `src/lib/notifications.ts` to support high importance/priority channels and custom/alarm sound configuration. Update `src/routes/_authenticated/settings.tsx` to include an "Alarm Priority for Medication Reminders" toggle and pass it when scheduling notifications.

**Tech Stack:** `@capacitor/local-notifications`, React, TanStack Start, Supabase, Tailwind CSS.

## Global Constraints
- Android platform target.
- TypeScript strict mode compliance.
- Zero errors on `npm run build` and `npx cap sync android`.

---

### Task 1: Update Notification Service with Alarm Priority & High Importance Channel

**Files:**
- Modify: `src/lib/notifications.ts`

**Interfaces:**
- Consumes: `@capacitor/local-notifications`
- Produces: `scheduleMedicationNotifications(medications, enabled, alarmPriority)`

- [ ] **Step 1: Update `src/lib/notifications.ts` to support `alarmPriority` channel and sound**

Modify `scheduleMedicationNotifications` to accept `alarmPriority: boolean`. When true, configure high importance (`importance: 5` or max priority) and alarm sound (`sound: 'alarm.wav'` or system alarm audio if available / default alarm sound settings).

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Zero errors.

---

### Task 2: Update Settings Notifications Section and Hook up Alarm Priority Toggle

**Files:**
- Modify: `src/routes/_authenticated/settings.tsx`

**Interfaces:**
- Consumes: `scheduleMedicationNotifications`
- Produces: Settings preference `pushNotifications.alarmPriorityMedications` and UI toggle in Notifications tab.

- [ ] **Step 1: Add `alarmPriorityMedications` state and UI toggle in Settings Notifications tab**

In `src/routes/_authenticated/settings.tsx`, add a switch in the Push Notifications / Medication Reminders card for "Alarm Priority for Medications" (makes medication reminders high importance with persistent alarm sound).

- [ ] **Step 2: Pass `alarmPriorityMedications` preference to `scheduleMedicationNotifications`**

Update the call to `scheduleMedicationNotifications` when preferences save or load.

- [ ] **Step 3: Run build, cap sync, and verify zero errors**

Run: `npm run build && npx cap sync android`
Expected: Zero errors.
