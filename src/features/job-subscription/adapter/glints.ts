// Glints adapter (fetch + persisted WAF cookies — no browser).
// Pattern learned from ifqygazhar/jobscraper-api scrape_glints.py:
// SSR explore endpoint + location UUIDs, but parsed from the stable
// `__NEXT_DATA__.props.pageProps.initialJobs.jobsInPage` JSON (their
// `aria-label="Job Card"` selector is stale) joined to DOM apply-links.
import * as cheerio from 'cheerio';
import type { FingerprintQuery, JobPosting } from '../types';
import { cookieHeader, wafHeaders } from './cookies';
import { matchesLocation } from './location';

const BASE = 'https://glints.com/id/opportunities/jobs/explore';
export const ENV = 'GLINTS_COOKIES';

// Location UUIDs from the reference controller's validated lists.
const LOCATIONS: { match: string[]; id: string; name: string }[] = [
  { match: ['jakarta selatan'], id: '078b37b2-e791-4739-958e-c29192e5df3e', name: 'Jakarta+Selatan,+DKI+Jakarta' },
  { match: ['jakarta barat'], id: 'af0ed74f-1b51-43cf-a14c-459996e39105', name: 'Jakarta+Barat,+DKI+Jakarta' },
  { match: ['jakarta utara'], id: 'ea61f4ac-5864-4b2b-a2c8-aa744a2aafea', name: 'Jakarta+Utara,+DKI+Jakarta' },
  { match: ['tangerang'], id: 'ae3c458e-5947-4833-8f1b-e001ce2fad1d', name: 'Tangerang,+Banten' },
  { match: ['bandung'], id: '86a3dc56-1bd7-4cd3-8225-d3e4b976e552', name: 'Bandung,+Jawa+Barat' },
  { match: ['dki jakarta', 'jakarta'], id: '78d63064-78a1-4577-8516-036a6c5e903e', name: 'DKI+Jakarta' },
  { match: ['banten'], id: '82f248c3-3fb3-4600-98fe-4afb47d7558d', name: 'Banten' },
  { match: ['jawa barat', 'jawabarat'], id: '06c9e480-42e7-4f11-9d6c-67ad64ccc0f6', name: 'Jawa+Barat' },
  { match: ['jabodetabek'], id: 'JABODETABEK', name: 'Jabodetabek' },
];

function resolveLocation(locationFilter: string): { id: string; name: string } {
  const f = (locationFilter || '').toLowerCase();
  for (const loc of LOCATIONS) {
    if (loc.match.some((m) => f.includes(m))) return { id: loc.id, name: loc.name };
  }
  return { id: '', name: 'All+Cities/Provinces' };
}

export function resultLimit(filters: Record<string, string>): number {
  const n = Number(filters.limit);
  if (Number.isFinite(n)) return Math.min(50, Math.max(1, Math.floor(n)));
  return 20;
}

function formatAgo(dateString: string | null | undefined): string {
  if (!dateString) return 'recently';
  const t = Date.parse(dateString);
  if (Number.isNaN(t)) return 'recently';
  const sec = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} minute${min === 1 ? '' : 's'} ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hour${hr === 1 ? '' : 's'} ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day} day${day === 1 ? '' : 's'} ago`;
  const week = Math.floor(day / 7);
  if (week < 5) return `${week} week${week === 1 ? '' : 's'} ago`;
  const month = Math.floor(day / 30);
  if (month < 12) return `${month} month${month === 1 ? '' : 's'} ago`;
  const year = Math.floor(day / 365);
  return `${year} year${year === 1 ? '' : 's'} ago`;
}

type GlintsRawJob = {
  id?: string;
  title?: string;
  type?: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
  company?: { name?: string; brandName?: string; logo?: string | null };
  location?: {
    formattedName?: string;
    parents?: { name?: string; administrativeLevelName?: string }[];
  };
  salaries?: {
    minAmount?: number | null;
    maxAmount?: number | null;
    CurrencyCode?: string;
    salaryMode?: string;
  }[];
};

export function extractNextDataJobs(html: string): GlintsRawJob[] {
  const $ = cheerio.load(html);
  const raw = $('#__NEXT_DATA__').html();
  if (!raw) throw new Error('Glints markup changed (no __NEXT_DATA__ — firewall or redesign)');
  const data = JSON.parse(raw) as {
    props?: { pageProps?: { initialJobs?: { jobsInPage?: GlintsRawJob[] } } };
  };
  return data.props?.pageProps?.initialJobs?.jobsInPage ?? [];
}

function formatSalary(s: GlintsRawJob['salaries']): string | null {
  const sal = (s ?? []).find((x) => x && (x.minAmount || x.maxAmount));
  if (!sal) return null;
  const curr = sal.CurrencyCode || 'IDR';
  const mode = sal.salaryMode && sal.salaryMode !== 'MONTH' ? ` /${sal.salaryMode.toLowerCase()}` : '';
  const fmt = (n: number) => n.toLocaleString('en-US');
  if (sal.minAmount && sal.maxAmount) return `${curr} ${fmt(sal.minAmount)} - ${fmt(sal.maxAmount)}${mode}`;
  if (sal.minAmount) return `${curr} ${fmt(sal.minAmount)}+${mode}`;
  if (sal.maxAmount) return `Up to ${curr} ${fmt(sal.maxAmount)}${mode}`;
  return null;
}

function formatLocation(j: GlintsRawJob): string {
  const parts = [j.location?.formattedName];
  for (const p of j.location?.parents ?? []) {
    if (p.administrativeLevelName === 'City' || p.administrativeLevelName === 'Province') {
      parts.push(p.name);
    }
  }
  return [...new Set(parts.filter(Boolean))].join(', ') || 'Indonesia';
}

/**
 * Pure mapper: NEXT_DATA jobs joined to DOM apply-links by job uuid.
 * Unit-testable without network.
 */
export function parseGlintsJobs(rawJobs: GlintsRawJob[], linkById: Map<string, string>): JobPosting[] {
  const out: JobPosting[] = [];
  const seen = new Set<string>();
  for (const j of rawJobs) {
    if (!j || !j.id || !j.title) continue;
    if (j.status && j.status !== 'OPEN') continue;
    const url = linkById.get(j.id);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    const published = j.updatedAt ?? j.createdAt ?? null;
    out.push({
      id: j.id,
      source: 'glints',
      position: j.title,
      company: j.company?.brandName || j.company?.name || 'Company',
      location: formatLocation(j),
      datetime: published,
      agoTime: formatAgo(published),
      salary: formatSalary(j.salaries),
      url,
      logo: null,
      description: null,
    });
  }
  return out;
}

/** DOM pass: apply-link hrefs keyed by job uuid from the URL path. */
export function extractGlintsLinks(html: string): Map<string, string> {
  const $ = cheerio.load(html);
  $('style,script').remove();
  const map = new Map<string, string>();
  $('a[href*="/opportunities/jobs/"]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href) return;
    const id = href.split('?')[0].split('/').filter(Boolean).pop();
    if (!id || map.has(id)) return;
    map.set(id, `https://glints.com${href.split('?')[0]}`);
  });
  return map;
}

export async function searchGlints(
  query: FingerprintQuery,
  _fingerprint: string,
): Promise<JobPosting[]> {
  const cookie = cookieHeader(ENV, 'glints');
  const loc = resolveLocation(query.location ?? '');
  const limit = resultLimit(query.filters);
  const tokens = (query.keywords || '').toLowerCase().split(/\s+/).filter(Boolean);
  const locationFilter = (query.location || '').toLowerCase().trim();

  const out: JobPosting[] = [];
  const seen = new Set<string>();
  for (let page = 1; page <= 2 && out.length < limit; page++) {
    const params = new URLSearchParams({
      keyword: query.keywords || '',
      country: 'ID',
      locationId: loc.id,
      locationName: loc.name,
      lowestLocationLevel: '1',
      page: String(page),
    });
    const res = await fetch(`${BASE}?${params.toString()}`, {
      headers: wafHeaders(cookie),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`Glints search failed: HTTP ${res.status} (cookies may be expired)`);
    const html = await res.text();
    const parsed = parseGlintsJobs(extractNextDataJobs(html), extractGlintsLinks(html));
    if (parsed.length === 0) break;
    for (const job of parsed) {
      if (seen.has(job.id)) continue;
      if (tokens.length > 0) {
        const hay = `${job.position} ${job.company}`.toLowerCase();
        if (!tokens.every((t) => hay.includes(t))) continue;
      }
      if (locationFilter && !matchesLocation(job.location, locationFilter)) continue;
      seen.add(job.id);
      out.push(job);
      if (out.length >= limit) break;
    }
  }
  return out;
}
