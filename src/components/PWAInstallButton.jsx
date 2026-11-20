import { useState } from 'react';
import { Download } from 'lucide-react';
import { usePWAInstall } from '../utils/usePWAInstall';

export default function PWAInstallButton({ compact = false }) {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className={
          compact
            ? 'ml-auto flex items-center gap-1.5 rounded border border-brass/50 bg-brass/15 px-2.5 py-1 text-xs font-medium text-brass-light hover:bg-brass/25 transition-colors'
            : 'w-full flex items-center justify-center gap-2 rounded-md border border-brass/50 bg-brass/15 px-3 py-2 text-xs font-medium text-brass-light hover:bg-brass/25 transition-colors mb-3'
        }
      >
        <Download className="w-3.5 h-3.5" />
        <span>Install App</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className={
            compact
              ? 'ml-auto flex items-center gap-1.5 rounded border border-white/20 px-2.5 py-1 text-xs font-medium text-white/80 hover:text-white transition-colors'
              : 'w-full flex items-center justify-center gap-2 rounded-md border border-white/20 px-3 py-2 text-xs font-medium text-white/80 hover:text-white transition-colors mb-3'
          }
        >
          <Download className="w-3.5 h-3.5" />
          <span>Install on iOS</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-sm rounded-lg bg-paper border border-ink/20 p-6 shadow-xl text-ink">
              <h3 className="font-display text-lg font-semibold text-ink">Install on iPhone / iPad</h3>
              <p className="mt-2 text-sm text-slate2 leading-relaxed">
                1. Tap the <strong>Share</strong> button in Safari&apos;s toolbar.<br />
                2. Scroll down and tap <strong>Add to Home Screen</strong>.
              </p>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-4 w-full rounded-md bg-ink py-2 text-sm font-medium text-paper hover:bg-ink-light transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
}
