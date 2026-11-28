import { Capacitor } from '@capacitor/core';

const GITHUB_RELEASES_API =
  'https://api.github.com/repos/imsbf83-coder/imsbf83/releases/latest';
const GITHUB_RUNS_API =
  'https://api.github.com/repos/imsbf83-coder/imsbf83/actions/runs?status=completed&per_page=5';
export const GITHUB_RELEASES_PAGE =
  'https://github.com/imsbf83-coder/imsbf83/releases';

export function getEmbeddedAppInfo() {
  const version =
    import.meta.env.VITE_APP_VERSION ||
    (typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : null) ||
    '1.0.0';

  const buildId =
    import.meta.env.PROD && typeof __APP_BUILD_ID__ !== 'undefined'
      ? __APP_BUILD_ID__
      : null;

  return {
    version: String(version).replace(/^v/i, ''),
    buildId: buildId ? String(buildId) : null,
  };
}

export function compareVersions(a, b) {
  const parse = (val) =>
    String(val || '0')
      .replace(/^v/i, '')
      .split('-')[0]
      .split('.')
      .map((part) => {
        const n = parseInt(part, 10);
        return Number.isFinite(n) ? n : 0;
      });

  const pa = parse(a);
  const pb = parse(b);
  const len = Math.max(pa.length, pb.length, 3);
  for (let i = 0; i < len; i += 1) {
    const va = pa[i] || 0;
    const vb = pb[i] || 0;
    if (va > vb) return 1;
    if (va < vb) return -1;
  }
  return 0;
}

function isGitSha(val) {
  return /^[0-9a-f]{40}$/i.test(String(val || ''));
}

export async function checkNativeApkUpdate() {
  const { version: currentVersion, buildId: currentBuildId } = getEmbeddedAppInfo();
  const headers = {
    Accept: 'application/vnd.github+json',
  };

  try {
    const relRes = await fetch(GITHUB_RELEASES_API, {
      headers,
      cache: 'no-store',
    });

    if (relRes.ok) {
      const release = await relRes.json();
      const latestVersion = String(release?.tag_name || '').replace(/^v/i, '') || currentVersion;
      const apkAsset = (release?.assets || []).find(
        (asset) =>
          typeof asset?.name === 'string' &&
          asset.name.toLowerCase().endsWith('.apk')
      );
      const downloadUrl =
        apkAsset?.browser_download_url ||
        release?.html_url ||
        GITHUB_RELEASES_PAGE;

      const hasUpdate = compareVersions(latestVersion, currentVersion) > 0;
      return {
        checked: true,
        mode: 'native',
        hasUpdate,
        currentVersion,
        latestVersion,
        currentBuildId: currentBuildId || `v${currentVersion}`,
        latestBuildId: `v${latestVersion}`,
        downloadUrl,
        releaseUrl: release?.html_url || GITHUB_RELEASES_PAGE,
        isDirectApk: Boolean(apkAsset?.browser_download_url),
      };
    }

    if (relRes.status === 404) {
      const runsRes = await fetch(GITHUB_RUNS_API, {
        headers,
        cache: 'no-store',
      });
      if (!runsRes.ok) {
        return { checked: false, mode: 'native', hasUpdate: false, currentVersion };
      }

      const data = await runsRes.json();
      const latestRun = (data?.workflow_runs || []).find(
        (run) =>
          run?.conclusion === 'success' &&
          (!run.head_branch || run.head_branch === 'main' || run.head_branch === 'master')
      );

      if (!latestRun) {
        return { checked: true, mode: 'native', hasUpdate: false, currentVersion, latestVersion: currentVersion };
      }

      const latestVersion = latestRun.run_number
        ? `1.0.${latestRun.run_number}`
        : currentVersion;
      const versionNewer = compareVersions(latestVersion, currentVersion) > 0;
      const shaChanged =
        isGitSha(currentBuildId) &&
        isGitSha(latestRun.head_sha) &&
        latestRun.head_sha !== currentBuildId &&
        compareVersions(latestVersion, currentVersion) >= 0;

      const hasUpdate = versionNewer || shaChanged;
      return {
        checked: true,
        mode: 'native',
        hasUpdate,
        currentVersion,
        latestVersion,
        currentBuildId: currentBuildId || `v${currentVersion}`,
        latestBuildId: latestRun.head_sha || `v${latestVersion}`,
        downloadUrl: latestRun.html_url || GITHUB_RELEASES_PAGE,
        releaseUrl: latestRun.html_url || GITHUB_RELEASES_PAGE,
        isDirectApk: false,
      };
    }

    return { checked: false, mode: 'native', hasUpdate: false, currentVersion };
  } catch {
    return { checked: false, mode: 'native', hasUpdate: false, currentVersion };
  }
}

export async function checkWebAppUpdate(versionUrl = '/version.json', baselineBuildIdRef = null) {
  const { version: currentVersion, buildId: embeddedBuildId } = getEmbeddedAppInfo();
  const baseline = baselineBuildIdRef?.current ?? embeddedBuildId;

  try {
    const separator = versionUrl.includes('?') ? '&' : '?';
    const response = await fetch(`${versionUrl}${separator}_t=${Date.now()}`, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' },
    });

    if (!response.ok) {
      return { checked: false, mode: 'web', hasUpdate: false, currentVersion };
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return { checked: false, mode: 'web', hasUpdate: false, currentVersion };
    }

    const data = await response.json();
    const remoteBuildId = data?.buildId ? String(data.buildId) : null;
    const latestVersion = data?.version ? String(data.version).replace(/^v/i, '') : currentVersion;
    if (!remoteBuildId) {
      return { checked: false, mode: 'web', hasUpdate: false, currentVersion };
    }

    if (!baseline) {
      if (baselineBuildIdRef) {
        baselineBuildIdRef.current = remoteBuildId;
      }
      return {
        checked: true,
        mode: 'web',
        hasUpdate: false,
        currentVersion,
        latestVersion,
        currentBuildId: remoteBuildId,
        latestBuildId: remoteBuildId,
      };
    }

    return {
      checked: true,
      mode: 'web',
      hasUpdate: remoteBuildId !== baseline,
      currentVersion,
      latestVersion,
      currentBuildId: baseline,
      latestBuildId: remoteBuildId,
    };
  } catch {
    return { checked: false, mode: 'web', hasUpdate: false, currentVersion };
  }
}

export async function checkForUpdate({ versionUrl = '/version.json', baselineBuildIdRef = null } = {}) {
  if (Capacitor.isNativePlatform()) {
    return checkNativeApkUpdate();
  }
  return checkWebAppUpdate(versionUrl, baselineBuildIdRef);
}
