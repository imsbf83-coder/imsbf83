import { useEffect, useState } from 'react';
import { Bell, CheckCircle2, RefreshCw, X } from 'lucide-react';
import { checkForUpdate, getEmbeddedAppInfo } from '../utils/appUpdate';
import {
  getNotificationPermission,
  getReminderPrefs,
  isNativeNotifications,
  isNotificationSupported,
  requestNotificationPermission,
  sendLocalNotification,
  syncDailyReminders,
} from '../utils/notifications';

export default function NotificationSettingsModal({ open, onClose }) {
  const [permission, setPermission] = useState('prompt');
  const [prefs, setPrefs] = useState(getReminderPrefs);
  const [statusMsg, setStatusMsg] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStatusMsg('');
    setPrefs(getReminderPrefs());
    getNotificationPermission().then(setPermission);
  }, [open]);

  if (!open) return null;

  const supported = isNotificationSupported();
  const isNative = isNativeNotifications();

  async function handleEnable() {
    setBusy(true);
    setStatusMsg('');
    try {
      const nextPerm = await requestNotificationPermission();
      setPermission(nextPerm);
      if (nextPerm === 'granted') {
        await syncDailyReminders(prefs);
        setStatusMsg('Notifications enabled.');
      } else {
        setStatusMsg('Permission denied. Allow notifications in device or browser settings.');
      }
    } catch {
      setStatusMsg('Could not request notification permission.');
    } finally {
      setBusy(false);
    }
  }

  async function togglePref(key) {
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    setStatusMsg('');
    if (permission === 'granted') {
      await syncDailyReminders(next);
      setStatusMsg('Reminder preferences saved.');
    } else {
      await syncDailyReminders(next);
    }
  }

  async function handleTest() {
    setBusy(true);
    setStatusMsg('');
    try {
      let currentPerm = permission;
      if (currentPerm !== 'granted') {
        currentPerm = await requestNotificationPermission();
        setPermission(currentPerm);
      }
      if (currentPerm !== 'granted') {
        setStatusMsg('Enable notification permission first.');
        return;
      }
      const ok = await sendLocalNotification({
        title: 'The Register — Test Alert',
        body: 'Notifications are active on this device.',
      });
      setStatusMsg(
        ok
          ? 'Test notification sent. Check your notification tray.'
          : 'Could not send notification on this device.'
      );
    } catch {
      setStatusMsg('Could not trigger test notification.');
    } finally {
      setBusy(false);
    }
  }

  async function handleCheckUpdates() {
    setBusy(true);
    setStatusMsg('');
    try {
      const result = await checkForUpdate();
      if (!result?.checked) {
        setStatusMsg('Could not reach update server. Check your internet connection.');
        return;
      }
      if (result.hasUpdate) {
        window.dispatchEvent(new CustomEvent('app:update-detected', { detail: result }));
        setStatusMsg(`Update available: v${result.latestVersion} (installed v${result.currentVersion}).`);
        if (permission === 'granted' && prefs.updateAlerts) {
          await sendLocalNotification({
            id: 2001,
            title: `The Register — Update v${result.latestVersion} Available`,
            body:
              result.mode === 'native'
                ? `A new Android app build (v${result.latestVersion}) is ready on GitHub.`
                : 'A newer version is ready. Refresh to apply.',
          }).catch(() => {});
        }
      } else {
        setStatusMsg(`You are on the latest version (v${result.currentVersion}).`);
      }
    } catch {
      setStatusMsg('Update check failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg border border-ink/15 bg-paper p-6 text-ink shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="rounded-md bg-ink p-2 text-brass-light">
              <Bell className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-display text-lg font-semibold text-ink">
                Notifications &amp; Reminders
              </h3>
              <p className="text-xs text-slate2">
                On-device alerts {isNative ? '(Android App)' : '(Browser)'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close notifications settings"
            className="rounded p-1 text-slate2 hover:bg-ink/5 hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 rounded-md border border-ink/10 bg-white p-3.5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-ink">Notification Permission</p>
              <p className="text-xs text-slate2">
                {!supported
                  ? 'Not supported in this browser'
                  : permission === 'granted'
                    ? 'Allowed on this device'
                    : permission === 'denied'
                      ? 'Blocked in system settings'
                      : 'Not enabled yet'}
              </p>
            </div>
            {supported && permission !== 'granted' && (
              <button
                type="button"
                disabled={busy}
                onClick={handleEnable}
                className="rounded bg-ink px-3 py-1.5 text-xs font-medium text-paper hover:bg-ink-light disabled:opacity-50"
              >
                Enable
              </button>
            )}
            {permission === 'granted' && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-present">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Active
              </span>
            )}
          </div>
        </div>

        <div className="mt-4 space-y-2.5">
          <label className="flex items-center justify-between rounded-md border border-ink/10 bg-white px-3.5 py-2.5 cursor-pointer">
            <div>
              <p className="text-sm font-medium text-ink">App Update Alerts</p>
              <p className="text-xs text-slate2">Notify when a new web or server update is ready</p>
            </div>
            <input
              type="checkbox"
              checked={prefs.updateAlerts}
              onChange={() => togglePref('updateAlerts')}
              className="h-4 w-4 accent-ink"
            />
          </label>

          <label className="flex items-center justify-between rounded-md border border-ink/10 bg-white px-3.5 py-2.5 cursor-pointer">
            <div>
              <p className="text-sm font-medium text-ink">Daily Attendance Reminder (8:30 AM)</p>
              <p className="text-xs text-slate2">
                {isNative
                  ? 'Scheduled daily Android notification'
                  : 'Available when installed as the Android app'}
              </p>
            </div>
            <input
              type="checkbox"
              checked={prefs.attendanceReminder}
              onChange={() => togglePref('attendanceReminder')}
              className="h-4 w-4 accent-ink"
            />
          </label>

          <label className="flex items-center justify-between rounded-md border border-ink/10 bg-white px-3.5 py-2.5 cursor-pointer">
            <div>
              <p className="text-sm font-medium text-ink">Morning Timetable Check (7:45 AM)</p>
              <p className="text-xs text-slate2">
                {isNative
                  ? 'Reminder to review arrangements before classes start'
                  : 'Available when installed as the Android app'}
              </p>
            </div>
            <input
              type="checkbox"
              checked={prefs.timetableReminder}
              onChange={() => togglePref('timetableReminder')}
              className="h-4 w-4 accent-ink"
            />
          </label>
        </div>

        {statusMsg && (
          <p className="mt-3 rounded bg-ink/5 px-3 py-2 text-xs text-ink">{statusMsg}</p>
        )}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
          <span className="font-mono text-[11px] text-slate2">
            v{getEmbeddedAppInfo().version}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={handleCheckUpdates}
              className="inline-flex items-center gap-1.5 rounded border border-ink/20 bg-white px-3 py-2 text-xs font-medium text-ink hover:bg-ink/5 disabled:opacity-50"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Check Updates
            </button>
            <button
              type="button"
              disabled={busy || !supported}
              onClick={handleTest}
              className="rounded border border-ink/20 bg-white px-3 py-2 text-xs font-medium text-ink hover:bg-ink/5 disabled:opacity-50"
            >
              Test Alert
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded bg-ink px-4 py-2 text-xs font-medium text-paper hover:bg-ink-light"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
