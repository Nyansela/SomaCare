# Local Push Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement local push notifications using `@capacitor/local-notifications` for Android in SomaCare, including permission handling on first app launch, medication reminders, daily health check-in reminders, and a Notifications section in Settings.

**Architecture:** Create a notification utility module (`src/lib/notifications.ts`) wrapping `@capacitor/local-notifications`. Integrate permission requests in app startup/root layout. Update database schema / type / state for medications to support `scheduled_time` and update Settings preferences schema to support daily check-in time and medication reminder preferences. Add a dedicated Notifications tab/card in Settings (`src/routes/_authenticated/settings.tsx`).

**Tech Stack:** `@capacitor/local-notifications`, React, TanStack Start, Supabase, Tailwind CSS.

## Global Constraints
- Android platform target.
- TypeScript strict mode compliance.
- Zero errors on `npm run build` and `npx cap sync android`.

---

### Task 1: Install @capacitor/local-notifications and update Database schema for medication scheduled time

**Files:**
- Modify: `package.json`
- Modify: `src/integrations/supabase/types.ts`
- Modify: `src/routes/_authenticated/medications.tsx`

**Interfaces:**
- Consumes: `@capacitor/local-notifications`
- Produces: `scheduled_time` field on medications table, `@capacitor/local-notifications` dependency installed.

- [ ] **Step 1: Install `@capacitor/local-notifications`**

Run: `bun add @capacitor/local-notifications` (or `npm install @capacitor/local-notifications`)
Expected: Package added to dependencies in `package.json`.

- [ ] **Step 2: Update Supabase types / medication form to support `scheduled_time`**

Modify `src/routes/_authenticated/medications.tsx` to include `scheduled_time` input when adding/editing medications.

- [ ] **Step 3: Run build & cap sync to verify integration setup**

Run: `npm run build && npx cap sync android`
Expected: Zero build/sync errors.

- [ ] **Step 4: Commit checkpoint** (Note: do not run git commit unless requested; skip git commit steps per project instructions).

---

### Task 2: Create Notification Utility Service

**Files:**
- Create: `src/lib/notifications.ts`

**Interfaces:**
- Consumes: `@capacitor/local-notifications`, Supabase client / user data.
- Produces: `requestNotificationPermissions()`, `scheduleMedicationNotifications(medications)`, `scheduleDailyCheckIn(time, enabled)`, `cancelAllNotifications()`.

- [ ] **Step 1: Create `src/lib/notifications.ts` with notification management logic**

```ts
import { LocalNotifications } from '@capacitor/local-notifications';

export async function requestNotificationPermissions(): Promise<boolean> {
  try {
    const perm = await LocalNotifications.checkPermissions();
    if (perm.display === 'granted') return true;
    const req = await LocalNotifications.requestPermissions();
    return req.display === 'granted';
  } catch (e) {
    console.error('Failed to request notification permissions:', e);
    return false;
  }
}

export async function scheduleMedicationNotifications(medications: Array<{ id: string; name: string; dose?: string; scheduled_time?: string }>, enabled: boolean) {
  try {
    // Clear existing medication notifications first (e.g. IDs 1000-2000)
    // Or manage specific IDs.
    if (!enabled) return;

    for (const [index, med] of medications.entries()) {
      if (!med.scheduled_time) continue;
      const [hours, minutes] = med.scheduled_time.split(':').map(Number);
      if (isNaN(hours) || isNaN(minutes)) continue;

      const notificationId = 1000 + index;
      await LocalNotifications.schedule({
        notifications: [
          {
            title: `Medication Reminder: ${med.name}`,
            body: `Time to take your medication${med.dose ? ` (${med.dose})` : ''}.`,
            id: notificationId,
            schedule: {
              on: { hour: hours, minute: minutes },
              repeats: true,
              allowWhileIdle: true,
            },
            sound: 'default',
          },
        ],
      });
    }
  } catch (e) {
    console.error('Failed to schedule medication notifications:', e);
  }
}

export async function scheduleDailyCheckInNotification(time: string, enabled: boolean) {
  try {
    const notificationId = 999;
    if (!enabled) {
      await LocalNotifications.cancel({ notifications: [{ id: notificationId }] });
      return;
    }

    const [hours, minutes] = time.split(':').map(Number);
    if (isNaN(hours) || isNaN(minutes)) return;

    await LocalNotifications.schedule({
      notifications: [
        {
          title: 'Daily Health Check-in',
          body: 'How are you feeling today? Tap to record your vitals and check-in.',
          id: notificationId,
          schedule: {
            on: { hour: hours, minute: minutes },
            repeats: true,
            allowWhileIdle: true,
          },
          sound: 'default',
        },
      ],
    });
  } catch (e) {
    console.error('Failed to schedule daily check-in notification:', e);
  }
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Zero errors.

---

### Task 3: Implement First Launch Permission Request & Settings Notifications Section

**Files:**
- Modify: `src/routes/__root.tsx` (or `src/components/app-shell.tsx` / `src/routes/_authenticated/app.tsx`)
- Modify: `src/routes/_authenticated/settings.tsx`

**Interfaces:**
- Consumes: `requestNotificationPermissions`, `scheduleMedicationNotifications`, `scheduleDailyCheckInNotification`.
- Produces: First-launch permission prompt on Android 13+, full Notifications section in Settings.

- [ ] **Step 1: Add first-launch permission request check in root or app shell**

Check on app load if notification permission has been requested or needed (especially on Android), calling `requestNotificationPermissions()`.

- [ ] **Step 2: Add Notifications section to Settings (`src/routes/_authenticated/settings.tsx`)**

Add controls for:
- Push notifications master toggle & sound.
- Daily health check-in toggle & time picker.
- Medication reminders toggle & default reminder time.
- Sync/reschedule notifications upon saving settings.

- [ ] **Step 3: Run build, cap sync, and verify zero errors**

Run: `npm run build && npx cap sync android`
Expected: Zero errors.
