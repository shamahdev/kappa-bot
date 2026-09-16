// Shared WAF-cookie plumbing for the reference-pattern adapters
// (Glints / Indeed / Jobstreet, learned from ifqygazhar/jobscraper-api):
// plain fetch is challenged (Cloudflare / vendor firewall), so requests carry
// persisted JS-challenge cookies harvested once in a real browser.
//
// The clearance binds to UA + IP: harvest with the exact WAF_UA below and
// refresh the env var when the WAF re-challenges (symptom: adapter throws
// HTTP 403). Same-IP deployments keep cookies valid longest.
export const WAF_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0';

/** Raw `Cookie` header value from env, or a clear throw when unset/expired. */
export function cookieHeader(envName: string, source: string): string {
  const value = (process.env[envName] ?? '').trim();
  if (!value) {
    throw new Error(
      `${source} needs fresh challenge cookies: set ${envName} (see .env.example)`,
    );
  }
  return value;
}

export function wafHeaders(cookie: string): Record<string, string> {
  return {
    'User-Agent': WAF_UA,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'id-ID,id;q=0.9,en;q=0.8',
    Cookie: cookie,
  };
}
