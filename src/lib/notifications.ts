import { LocalNotifications } from "@capacitor/local-notifications";
import { Capacitor } from "@capacitor/core";

// Capacitor injects a global `window.Capacitor` on native builds. Declare it
// here so `window.Capacitor` typechecks on web where the type isn't global.
declare global {
  interface Window {
    Capacitor?: {
      isNativePlatform?: () => boolean;
      getPlatform?: () => string;
    };
  }
}

export async function requestNotificationPermissions(): Promise<boolean> {
  try {
    if (!Capacitor.isNativePlatform() && !window.Capacitor) {
      return true;
    }
    const perm = await LocalNotifications.checkPermissions();
    if (perm.display === "granted") return true;
    const req = await LocalNotifications.requestPermissions();
    return req.display === "granted";
  } catch (e) {
    console.error("Failed to request notification permissions:", e);
    return false;
  }
}

export async function cancelAllNotifications(): Promise<void> {
  try {
    if (!Capacitor.isNativePlatform() && !window.Capacitor) return;

    const pending = await LocalNotifications.getPending();
    if (pending.notifications && pending.notifications.length > 0) {
      await LocalNotifications.cancel({
        notifications: pending.notifications.map((n) => ({ id: n.id })),
      });
    }
  } catch (e) {
    console.error("Failed to cancel all notifications:", e);
  }
}

export interface MedicationReminderItem {
  id: string;
  name: string;
  dose?: string | null;
  scheduled_time?: string | null; // e.g. "08:00"
}

export async function scheduleMedicationNotifications(
  medications: Array<MedicationReminderItem>,
  enabled: boolean,
  alarmPriority: boolean = false,
): Promise<void> {
  try {
    if (!Capacitor.isNativePlatform() && !window.Capacitor) return;

    const pending = await LocalNotifications.getPending();
    const medNotificationIds = pending.notifications
      .filter((n) => n.id >= 1000 && n.id < 2000)
      .map((n) => ({ id: n.id }));

    if (medNotificationIds.length > 0) {
      await LocalNotifications.cancel({ notifications: medNotificationIds });
    }

    if (!enabled) return;

    if (alarmPriority) {
      try {
        await LocalNotifications.createChannel({
          id: "alarm-medications",
          name: "Alarm Priority Medications",
          description: "High priority medication reminders with alarm sound",
          importance: 5,
          sound: "alarm.wav",
          vibration: true,
        });
      } catch (channelErr) {
        console.error("Failed to create alarm notification channel:", channelErr);
      }
    }

    for (const [index, med] of medications.entries()) {
      if (!med.scheduled_time) continue;
      const [hours, minutes] = med.scheduled_time.split(":").map(Number);
      if (isNaN(hours) || isNaN(minutes)) continue;

      const notificationId = 1000 + index;
      await LocalNotifications.schedule({
        notifications: [
          {
            title: `Medication Reminder: ${med.name}`,
            body: `Time to take your medication${med.dose ? ` (${med.dose})` : ""}.`,
            id: notificationId,
            schedule: {
              on: { hour: hours, minute: minutes },
              repeats: true,
              allowWhileIdle: true,
            },
            sound: alarmPriority ? "alarm.wav" : "default",
            ...(alarmPriority ? { channelId: "alarm-medications" } : {}),
          },
        ],
      });
    }
  } catch (e) {
    console.error("Failed to schedule medication notifications:", e);
  }
}

export async function scheduleDailyCheckInNotification(
  time: string, // e.g. "20:00"
  enabled: boolean,
): Promise<void> {
  try {
    if (!Capacitor.isNativePlatform() && !window.Capacitor) return;

    const notificationId = 999;

    try {
      await LocalNotifications.cancel({ notifications: [{ id: notificationId }] });
    } catch {
      // ignore if not found
    }

    if (!enabled) return;

    const [hours, minutes] = time.split(":").map(Number);
    if (isNaN(hours) || isNaN(minutes)) return;

    await LocalNotifications.schedule({
      notifications: [
        {
          title: "Daily Health Check-in",
          body: "How are you feeling today? Tap to record your vitals and check-in.",
          id: notificationId,
          schedule: {
            on: { hour: hours, minute: minutes },
            repeats: true,
            allowWhileIdle: true,
          },
          sound: "default",
        },
      ],
    });
  } catch (e) {
    console.error("Failed to schedule daily check-in notification:", e);
  }
}
