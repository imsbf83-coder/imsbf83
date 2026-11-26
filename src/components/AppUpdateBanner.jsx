import { useEffect, useRef, useState } from 'react';
import { RefreshCw, X } from 'lucide-react';
import client from '../api/client';

const CHECK_INTERVAL_MS = 2 * 60 * 1000;

function getCurrentBundleSrc() {
  if (typeof document === 'undefined') return null;
  const el = document.querySelector('script[type="module"][src*="/assets/"]');
  return el ? el.getAttribute('src') : null;
}

export default function AppUpdateBanner() {
  const [updateReason, setUpdateReason] = useState(null);
  const [dismissed, setDismissed] = useState(false);
  const [updating, setUpdating] = useState(false);

  const initialBackendVersionRef = useRef(null);
  const initialBuildIdRef = useRef(
    typeof __APP_BUILD_ID__ !== 'undefined' ? __APP_BUILD_ID__ : null
  );
  const initialBundleSrcRef = useRef(getCurrentBundleSrc());

  useEffect(() => {
    let active = true;

    async function checkServiceWorker() {
      if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        if (!reg) return;
        if (reg.waiting && active) {
          setUpdateReason('A new app update is ready.');
          setDismissed(false);
        }
        await reg.update();
      } catch {
        // Ignore transient offline / SW check errors
      }
    }

    async function checkVersionManifest() {
      if (!import.meta.env.PROD) return;
      try {
        const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) return;
        const ct = res.headers.get('content-type') || '';
        if (!ct.includes('application/json')) return;
        const data = await res.json();
        if (!data?.buildId) return;

        if (!initialBuildIdRef.current) {
          initialBuildIdRef.current = data.buildId;
          return;
        }
        if (data.buildId !== initialBuildIdRef.current && active) {
          setUpdateReason('A new version of The Register is available.');
          setDismissed(false);
        }
      } catch {
        // Ignore network errors while offline
      }
    }

    async function checkHtmlEntryHash() {
      if (!import.meta.env.PROD) return;
      if (typeof window === 'undefined' || !window.location.protocol.startsWith('http')) return;
      if (!initialBundleSrcRef.current) return;
      try {
        const res = await fetch(`/?__v=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) return;
        const html = await res.text();
        const match = html.match(/src="(\/assets\/[^"]+\.js)"/);
        if (match && match[1] && match[1] !== initialBundleSrcRef.current && active) {
          setUpdateReason('A new web update has been published.');
          setDismissed(false);
        }
      } catch {
        // Ignore network errors while offline
      }
    }

    async function checkBackendVersion() {
      try {
        const { data } = await client.get('/health', { params: { _t: Date.now() } });
        const remoteVersion =
          data?.version || data?.buildId || data?.commit || data?.bootId || null;
        if (!remoteVersion) return;
        if (!initialBackendVersionRef.current) {
          initialBackendVersionRef.current = remoteVersion;
          return;
        }
        if (remoteVersion !== initialBackendVersionRef.current && active) {
          setUpdateReason('The server has been updated.');
          setDismissed(false);
        }
      } catch {
        // Ignore transient offline or cold-start errors
      }
    }

    async function runAllChecks() {
      if (typeof navigator !== 'undefined' && !navigator.onLine) return;
      await Promise.all([
        checkServiceWorker(),
        checkVersionManifest(),
        checkHtmlEntryHash(),
        checkBackendVersion(),
      ]);
    }

    let swRegCleanup = null;
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then((reg) => {
        if (!reg || !active) return;
        const onUpdateFound = () => {
          const installing = reg.installing;
          if (!installing) return;
          installing.addEventListener('statechange', () => {
            if (
              installing.state === 'installed' &&
              navigator.serviceWorker.controller &&
              active
            ) {
              setUpdateReason('A new app update is ready.');
              setDismissed(false);
            }
          });
        };
        reg.addEventListener('updatefound', onUpdateFound);
        swRegCleanup = () => reg.removeEventListener('updatefound', onUpdateFound);
      });
    }

    const onVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        runAllChecks();
      }
    };

    // Delay initial check slightly so app startup stays fast
    const initialTimer = setTimeout(runAllChecks, 3000);
    const interval = setInterval(runAllChecks, CHECK_INTERVAL_MS);
    window.addEventListener('focus', onVisibilityOrFocus);
    document.addEventListener('visibilitychange', onVisibilityOrFocus);

    return () => {
      active = false;
      clearTimeout(initialTimer);
      clearInterval(interval);
      window.removeEventListener('focus', onVisibilityOrFocus);
      document.removeEventListener('visibilitychange', onVisibilityOrFocus);
      if (swRegCleanup) swRegCleanup();
    };
  }, []);

  async function applyUpdate() {
    setUpdating(true);
    try {
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg?.waiting) {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
      }
      if ('caches' in window) {
        const keys = await window.caches.keys();
        await Promise.all(keys.map((k) => window.caches.delete(k)));
      }
    } catch {
      // Proceed to reload even if cache cleanup fails
    }
    window.location.reload();
  }

  if (!updateReason || dismissed) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 inset-x-4 sm:inset-x-auto sm:right-4 z-50 sm:max-w-sm rounded-lg border border-brass/50 bg-ink text-paper p-3.5 shadow-xl flex items-start gap-3"
    >
      <div className="mt-0.5 rounded-md bg-brass/20 p-1.5 text-brass-light shrink-0">
        <RefreshCw className={`w-4 h-4 ${updating ? 'animate-spin' : ''}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-display text-sm font-semibold leading-snug text-paper">
          Update Available
        </p>
        <p className="mt-0.5 text-xs text-white/75 leading-relaxed">
          {updateReason} Refresh to load the latest changes.
        </p>
        <div className="mt-2.5 flex items-center gap-2">
          <button
            type="button"
            disabled={updating}
            onClick={applyUpdate}
            className="rounded bg-brass px-3 py-1.5 text-xs font-semibold text-ink hover:bg-brass-light transition-colors disabled:opacity-60"
          >
            {updating ? 'Updating...' : 'Update Now'}
          </button>
          <button
            type="button"
            disabled={updating}
            onClick={() => setDismissed(true)}
            className="rounded px-2.5 py-1.5 text-xs text-white/70 hover:text-white transition-colors"
          >
            Later
          </button>
        </div>
      </div>
      <button
        type="button"
        aria-label="Dismiss update notification"
        onClick={() => setDismissed(true)}
        className="text-white/50 hover:text-white p-0.5 shrink-0"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
