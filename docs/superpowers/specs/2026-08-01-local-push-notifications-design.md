# Design Doc: Local Push Notifications for SomaCare (Android)

## Overview
Implement local push notifications using `@capacitor/local-notifications` in the SomaCare Android application (TanStack Start + React + Capacitor).

## Requirements & Scope
1. **Capacitor Plugin Setup**: Install `@capacitor/local-notifications` and configure Android native settings.
2. **Permission Handling**: Request explicit notification permission on first app launch (required for Android 13+).
3. **Notification Triggers**:
   - **Medication Reminders**: Triggered at scheduled times for active medications in Health Vault / medications table (supporting per-medication scheduled time).
   - **Daily Check-in Reminder**: A daily general health check-in reminder at a configurable time set in Settings.
4. **Settings Section**: Add a dedicated Notifications section in Settings (`src/routes/_authenticated/settings.tsx`) where users can:
   - Toggle medication reminders on/off and configure default reminder time.
   - Toggle daily health check-in reminder on/off and set its reminder time.
   - Toggle general push notifications / sound.
5. **Verification**: Run `npm run build`, `npx cap sync android`, and confirm zero errors.

## Architecture & Components
- **Notification Service (`src/lib/notifications.ts`)**:
  - `requestPermissions()`: Requests notification permissions via `LocalNotifications.requestPermissions()`.
  - `checkPermissions()`: Checks current permission status.
  - `scheduleMedicationReminders(medications, enabled)`: Schedules daily/recurring local notifications for medications based on their scheduled time.
  - `scheduleDailyCheckIn(time, enabled)`: Schedules daily general health check-in notification.
  - `cancelAllNotifications()` / specific notification management.
- **Settings Integration**:
  - Store push notification preferences in user profile preferences (Supabase `profiles.preferences` table) and synchronize with Capacitor Local Notifications upon save or app startup.
- **First Launch Permission Request**:
  - Check on initial app load (e.g. in root layout or app shell) if permissions have been requested/granted, and prompt if necessary on Android 13+.

## Testing & Verification Plan
- Build app with `npm run build`.
- Sync Capacitor with `npx cap sync android`.
- Verify TypeScript compilation and build output.
