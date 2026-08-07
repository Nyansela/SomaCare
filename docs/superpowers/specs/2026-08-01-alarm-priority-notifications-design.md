# Design Doc: Alarm Priority Notifications for SomaCare (Android)

## Overview
Add an "alarm" mode for critical reminders (medication reminders) in SomaCare using `@capacitor/local-notifications` without custom native code.

## Requirements & Scope
1. **Alarm Priority Option**: Add a global toggle in Settings ("Alarm Priority for Medications") to mark medication reminders as high priority/alarm mode.
2. **Channel & Priority Configuration**:
   - Configure a high importance Android channel (`importance: 5` / high priority) with custom/alarm sound (`sound: 'alarm.wav'` or system alarm sound / default loud sound options available in Capacitor Local Notifications).
   - Set notification attributes for high visibility and persistence.
3. **Settings Update**: Add the toggle in the Notifications section of Settings (`src/routes/_authenticated/settings.tsx`).
4. **Verification**: Run `npm run build`, `npx cap sync android`, and confirm zero errors.

## Architecture & Changes
- **`src/lib/notifications.ts`**:
  - Update `scheduleMedicationNotifications` to accept `alarmPriority: boolean`.
  - Configure `channelId: 'alarm-channel'` (with high importance and alarm sound) when `alarmPriority` is true, or default channel otherwise.
- **`src/routes/_authenticated/settings.tsx`**:
  - Add `alarmPriorityMedications: boolean` in preferences state.
  - Add UI switch in Notifications tab for "Alarm Priority for Medications".
  - Pass this preference when triggering `scheduleMedicationNotifications`.
