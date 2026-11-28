import { useCallback, useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Download, RefreshCw, X } from 'lucide-react';
import {
  ensureNotificationPermissionOnce,
  getReminderPrefs,
  sendLocalNotification,
} from '../utils/notifications';
import { checkForUpdate, getEmbeddedAppInfo } from '../utils/appUpdate';

const WEB_POLL_INTERVAL_MS = 60 * 1000;
const NATIVE_POLL_INTERVAL_MS = 10 * 60 * 1000;
const NATIVE_RESUME_THROTTLE_MS = 3 * 60 * 1000;

export default function VersionCheckToast({
  versionUrl = '/version.json',
  intervalMs,
}) {
  const isNative = Capacitor.isNativePlatform();
  const effectiveIntervalMs =
    intervalMs || (isNative ? NATIVE_POLL_INTERVAL_MS : WEB_POLL_INTERVAL_MS);

  const embedded = getEmbeddedAppInfo();
  const currentBuildIdRef = useRef(embedded.buildId);
  const notifiedKeyRef = useRef(null);
  const lastCheckAtRef = useRef(0);

  const [updateInfo, setUpdateInfo] = useState(null);
  const [dismissedKey, setDismissedKey] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const runCheck = useCallback(
    async ({ force = false } = {}) => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) return;

      const now = Date.now();
      if (
        isNative &&
        !force &&
        lastCheckAtRef.current > 0 &&
        now - lastCheckAtRef.current < NATIVE_RESUME_THROTTLE_MS
      ) {
        return;
      }
      lastCheckAtRef.current = now;

      const result = await checkForUpdate({
        versionUrl,
        baselineBuildIdRef: currentBuildIdRef,
      });

      if (!result?.checked || !result.hasUpdate) return;

      const updateKey =
        result.mode === 'native'
          ? `native:${result.latestVersion}:${result.latestBuildId}`
          : `web:${result.latestBuildId}`;

      setUpdateInfo({ ...result, updateKey });

      if (
        notifiedKeyRef.current !== updateKey &&
        getReminderPrefs().updateAlerts
      ) {
        notifiedKeyRef.current = updateKey;
        const notifTitle =
          result.mode === 'native'
            ? `The Register — Update v${result.latestVersion} Available`
            : 'The Register — Update Available';
        const notifBody =
          result.mode === 'native'
            ? `A new Android app build (v${result.latestVersion}) is ready on GitHub. Open the app to download.`
            : 'A newer version is live on the server. Tap Refresh Now to load the latest changes.';

        sendLocalNotification({
          id: 2001,
          title: notifTitle,
          body: notifBody,
        }).catch(() => {});
      }
    },
    [isNative, versionUrl]
  );

  useEffect(() => {
    if (isNative) {
      ensureNotificationPermissionOnce().catch(() => {});
    }

    const initialTimer = setTimeout(() => runCheck({ force: true }), 2500);
    const pollTimer = setInterval(() => runCheck({ force: true }), effectiveIntervalMs);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        runCheck({ force: false });
      }
    };

    const handleDetected = (event) => {
      const detail = event?.detail;
      if (!detail?.hasUpdate) return;
      const updateKey =
        detail.mode === 'native'
          ? `native:${detail.latestVersion}:${detail.latestBuildId}`
          : `web:${detail.latestBuildId}`;
      setDismissedKey(null);
      setUpdateInfo({ ...detail, updateKey });
    };

    window.addEventListener('focus', handleVisibility);
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('app:update-detected', handleDetected);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(pollTimer);
      window.removeEventListener('focus', handleVisibility);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('app:update-detected', handleDetected);
    };
  }, [effectiveIntervalMs, isNative, runCheck]);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg?.waiting) {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
        await reg?.update().catch(() => {});
      }
      if (typeof window !== 'undefined' && 'caches' in window) {
        const keys = await window.caches.keys();
        await Promise.all(keys.map((key) => window.caches.delete(key)));
      }
    } catch {
      // Proceed with reload even if cache cleanup fails
    }
    window.location.reload();
  }

  if (!updateInfo || dismissedKey === updateInfo.updateKey) {
    return null;
  }

  const isApkUpdate = updateInfo.mode === 'native';

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="fixed bottom-4 inset-x-4 sm:inset-x-auto sm:right-4 z-50 sm:max-w-sm rounded-lg border border-brass/60 bg-ink text-paper p-4 shadow-2xl flex items-start gap-3"
    >
      <div className="mt-0.5 rounded-md bg-brass/20 p-1.5 text-brass-light shrink-0">
        {isApkUpdate ? (
          <Download className="w-4 h-4" />
        ) : (
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-display text-sm font-semibold leading-snug text-paper">
          {isApkUpdate
            ? `New App Update (v${updateInfo.latestVersion})`
            : 'New Update Available'}
        </p>
        <p className="mt-1 text-xs text-white/80 leading-relaxed">
          {isApkUpdate
            ? updateInfo.isDirectApk
              ? 'A newer APK build is ready on GitHub Releases. Download and install to apply the latest changes.'
              : 'A newer APK build succeeded on GitHub Actions. Open the build page to download the latest APK.'
            : 'A newer version of The Register is live on the server. Refresh to apply the latest changes.'}
        </p>
        <p className="mt-1 font-mono text-[10px] text-white/45 truncate">
          {isApkUpdate
            ? `Installed v${updateInfo.currentVersion} → Latest v${updateInfo.latestVersion}`
            : `Build ${String(updateInfo.currentBuildId || '').slice(0, 16)} → ${String(updateInfo.latestBuildId || '').slice(0, 16)}`}
        </p>

        <div className="mt-3 flex items-center gap-2">
          {isApkUpdate ? (
            <a
              href={updateInfo.downloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded bg-brass px-3 py-1.5 text-xs font-semibold text-ink hover:bg-brass-light transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              {updateInfo.isDirectApk ? 'Download APK' : 'Get Update'}
            </a>
          ) : (
            <button
              type="button"
              disabled={refreshing}
              onClick={handleRefresh}
              className="rounded bg-brass px-3 py-1.5 text-xs font-semibold text-ink hover:bg-brass-light transition-colors disabled:opacity-60"
            >
              {refreshing ? 'Refreshing...' : 'Refresh Now'}
            </button>
          )}
          <button
            type="button"
            disabled={refreshing}
            onClick={() => setDismissedKey(updateInfo.updateKey)}
            className="rounded px-2.5 py-1.5 text-xs text-white/70 hover:text-white transition-colors"
          >
            Later
          </button>
        </div>
      </div>

      <button
        type="button"
        aria-label="Dismiss update notification"
        onClick={() => setDismissedKey(updateInfo.updateKey)}
        className="text-white/50 hover:text-white p-0.5 shrink-0"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
