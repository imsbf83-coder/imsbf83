import { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshCw, X } from 'lucide-react';
import { getReminderPrefs, sendLocalNotification } from '../utils/notifications';

const DEFAULT_POLL_INTERVAL_MS = 60 * 1000;

export default function VersionCheckToast({
  versionUrl = '/version.json',
  intervalMs = DEFAULT_POLL_INTERVAL_MS,
}) {
  const embeddedBuildId =
    import.meta.env.PROD && typeof __APP_BUILD_ID__ !== 'undefined'
      ? __APP_BUILD_ID__
      : null;

  const currentBuildIdRef = useRef(embeddedBuildId);
  const notifiedBuildRef = useRef(null);

  const [serverBuildId, setServerBuildId] = useState(null);
  const [dismissedForBuild, setDismissedForBuild] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const checkVersion = useCallback(async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;

    try {
      const separator = versionUrl.includes('?') ? '&' : '?';
      const response = await fetch(`${versionUrl}${separator}_t=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      });

      if (!response.ok) return;
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) return;

      const data = await response.json();
      const remoteBuildId = data?.buildId ? String(data.buildId) : null;
      if (!remoteBuildId) return;

      if (!currentBuildIdRef.current) {
        currentBuildIdRef.current = remoteBuildId;
        return;
      }

      if (remoteBuildId !== currentBuildIdRef.current) {
        setServerBuildId(remoteBuildId);

        if (
          notifiedBuildRef.current !== remoteBuildId &&
          getReminderPrefs().updateAlerts
        ) {
          notifiedBuildRef.current = remoteBuildId;
          sendLocalNotification({
            id: 2001,
            title: 'The Register — Update Available',
            body: 'A new version is available. Tap Refresh Now to load the latest changes.',
          }).catch(() => {});
        }
      }
    } catch {
      // Ignore transient offline or network errors during periodic polling
    }
  }, [versionUrl]);

  useEffect(() => {
    const initialTimer = setTimeout(checkVersion, 2500);
    const pollTimer = setInterval(checkVersion, intervalMs);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        checkVersion();
      }
    };

    window.addEventListener('focus', handleVisibility);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(pollTimer);
      window.removeEventListener('focus', handleVisibility);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [checkVersion, intervalMs]);

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

  if (!serverBuildId || dismissedForBuild === serverBuildId) {
    return null;
  }

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="fixed bottom-4 inset-x-4 sm:inset-x-auto sm:right-4 z-50 sm:max-w-sm rounded-lg border border-brass/60 bg-ink text-paper p-4 shadow-2xl flex items-start gap-3"
    >
      <div className="mt-0.5 rounded-md bg-brass/20 p-1.5 text-brass-light shrink-0">
        <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-display text-sm font-semibold leading-snug text-paper">
          New Update Available
        </p>
        <p className="mt-1 text-xs text-white/80 leading-relaxed">
          A newer version of The Register is live on the server. Refresh to apply the latest changes.
        </p>
        <p className="mt-1 font-mono text-[10px] text-white/45 truncate">
          Build {String(currentBuildIdRef.current).slice(0, 16)} → {serverBuildId.slice(0, 16)}
        </p>

        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            disabled={refreshing}
            onClick={handleRefresh}
            className="rounded bg-brass px-3 py-1.5 text-xs font-semibold text-ink hover:bg-brass-light transition-colors disabled:opacity-60"
          >
            {refreshing ? 'Refreshing...' : 'Refresh Now'}
          </button>
          <button
            type="button"
            disabled={refreshing}
            onClick={() => setDismissedForBuild(serverBuildId)}
            className="rounded px-2.5 py-1.5 text-xs text-white/70 hover:text-white transition-colors"
          >
            Later
          </button>
        </div>
      </div>

      <button
        type="button"
        aria-label="Dismiss update notification"
        onClick={() => setDismissedForBuild(serverBuildId)}
        className="text-white/50 hover:text-white p-0.5 shrink-0"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
