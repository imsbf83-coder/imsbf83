import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

const CHANNEL_ID = 'school-erp-alerts';
const PREFS_KEY = 'register_notification_prefs_v1';
const ATTENDANCE_REMINDER_ID = 1001;
const TIMETABLE_REMINDER_ID = 1002;

const DEFAULT_PREFS = {
  attendanceReminder: false,
  timetableReminder: false,
  updateAlerts: true,
};

let channelReady = false;

export function getReminderPrefs() {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return { ...DEFAULT_PREFS };
    return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function saveReminderPrefs(next) {
  const merged = { ...DEFAULT_PREFS, ...next };
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(merged));
  } catch {
    // Ignore storage errors
  }
  return merged;
}

export function isNativeNotifications() {
  return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('LocalNotifications');
}

export function isNotificationSupported() {
  if (isNativeNotifications()) return true;
  return typeof window !== 'undefined' && 'Notification' in window;
}

async function ensureChannel() {
  if (!isNativeNotifications() || channelReady) return;
  try {
    await LocalNotifications.createChannel({
      id: CHANNEL_ID,
      name: 'The Register Alerts',
      description: 'Daily school reminders and update alerts',
      importance: 4,
      visibility: 1,
      vibration: true,
    });
    channelReady = true;
  } catch {
    // Ignore on platforms where channels are unsupported
  }
}

export async function getNotificationPermission() {
  if (isNativeNotifications()) {
    try {
      const status = await LocalNotifications.checkPermissions();
      if (status.display === 'granted') return 'granted';
      if (status.display === 'denied') return 'denied';
      return 'prompt';
    } catch {
      return 'prompt';
    }
  }
  if (typeof window !== 'undefined' && 'Notification' in window) {
    if (Notification.permission === 'granted') return 'granted';
    if (Notification.permission === 'denied') return 'denied';
    return 'prompt';
  }
  return 'denied';
}

export async function requestNotificationPermission() {
  if (isNativeNotifications()) {
    await ensureChannel();
    const res = await LocalNotifications.requestPermissions();
    return res.display === 'granted' ? 'granted' : 'denied';
  }
  if (typeof window !== 'undefined' && 'Notification' in window) {
    const result = await Notification.requestPermission();
    return result === 'granted' ? 'granted' : 'denied';
  }
  return 'denied';
}

export async function sendLocalNotification({ title, body, id }) {
  const perm = await getNotificationPermission();
  if (perm !== 'granted') return false;

  if (isNativeNotifications()) {
    await ensureChannel();
    const notifId = id || Math.floor(2000 + (Date.now() % 100000));
    await LocalNotifications.schedule({
      notifications: [
        {
          id: notifId,
          title,
          body,
          channelId: CHANNEL_ID,
          schedule: { at: new Date(Date.now() + 250) },
        },
      ],
    });
    return true;
  }

  if (typeof window !== 'undefined' && 'Notification' in window) {
    new Notification(title, {
      body,
      icon: '/pwa-192x192.png',
    });
    return true;
  }

  return false;
}

export async function syncDailyReminders(prefs) {
  const saved = saveReminderPrefs(prefs);
  if (!isNativeNotifications()) return saved;

  const perm = await getNotificationPermission();
  if (perm !== 'granted') return saved;

  await ensureChannel();

  try {
    await LocalNotifications.cancel({
      notifications: [
        { id: ATTENDANCE_REMINDER_ID },
        { id: TIMETABLE_REMINDER_ID },
      ],
    });
  } catch {
    // Ignore if not previously scheduled
  }

  const toSchedule = [];
  if (saved.attendanceReminder) {
    toSchedule.push({
      id: ATTENDANCE_REMINDER_ID,
      title: 'The Register — Attendance Reminder',
      body: 'Remember to mark today’s class attendance.',
      channelId: CHANNEL_ID,
      schedule: {
        on: { hour: 8, minute: 30 },
        repeats: true,
        allowWhileIdle: true,
      },
    });
  }

  if (saved.timetableReminder) {
    toSchedule.push({
      id: TIMETABLE_REMINDER_ID,
      title: 'The Register — Morning Timetable',
      body: 'Check teacher absences and period arrangements for today.',
      channelId: CHANNEL_ID,
      schedule: {
        on: { hour: 7, minute: 45 },
        repeats: true,
        allowWhileIdle: true,
      },
    });
  }

  if (toSchedule.length > 0) {
    await LocalNotifications.schedule({ notifications: toSchedule });
  }

  return saved;
}
