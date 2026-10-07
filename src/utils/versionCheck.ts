/** GitHub release info helpers for the update check. */

const RELEASES_API_URL = 'https://api.github.com/repos/ButcchPro/gravity-markdown/releases/latest';
export const RELEASES_PAGE_URL = 'https://github.com/ButcchPro/gravity-markdown/releases/latest';

/**
 * Fetches the latest published GitHub release tag (e.g. "v1.0.5" → "1.0.5").
 * Returns null on any failure (offline, rate limit) — the update check must
 * never block or break startup.
 */
export async function fetchLatestGitHubVersion(): Promise<string | null> {
  try {
    const response = await fetch(RELEASES_API_URL, {
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (!response.ok) {
      console.warn(`Release lookup failed: HTTP ${response.status}`);
      return null;
    }
    const json = (await response.json()) as { tag_name?: unknown };
    const tag = typeof json.tag_name === 'string' ? json.tag_name : '';
    const version = tag.replace(/^v/, '').trim();
    return /^\d+(\.\d+)*$/.test(version) ? version : null;
  } catch (e) {
    console.warn('Update check failed:', e);
    return null;
  }
}

/** Numeric dot-version comparison: isNewer('1.0.4', '1.0.5') → true. */
export function isNewer(current: string, latest: string): boolean {
  const parse = (v: string) => v.split('.').map((n) => parseInt(n, 10) || 0);
  const c = parse(current);
  const l = parse(latest);
  for (let i = 0; i < Math.max(c.length, l.length); i += 1) {
    const cPart = c[i] ?? 0;
    const lPart = l[i] ?? 0;
    if (lPart !== cPart) return lPart > cPart;
  }
  return false;
}
