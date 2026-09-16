// Jobstreet ID adapter (fetch + persisted WAF cookies — no browser).
// URL pattern learned from ifqygazhar/jobscraper-api scrape_jobstreet.py
// (`/{work}-jobs/in-{location}?page=`), card selectors verified live
// 2026-09-08: `article[data-job-id]` + `data-automation` hooks
// (jobTitle/jobCompany/jobCardLocation/jobSalary/jobListingDate/
// jobShortDescription). Plain fetch gets Cloudflare 403 without cookies.
import * as cheerio from 'cheerio';
import type { FingerprintQuery, JobPosting } from '../types';
import { cookieHeader, wafHeaders } from './cookies';
import { matchesLocation } from './location';

const BASE = 'https://id.jobstreet.com';
export const ENV = 'JOBSTREET_COOKIES';
const MAX_PAGES = 2;

export function resultLimit(filters: Record<string, string>): number {
  const n = Number(filters.limit);
  if (Number.isFinite(n)) return Math.min(50, Math.max(1, Math.floor(n)));
  return 20;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/[\s_]+/g, '-');
}

/** SEO search path (verified live); falls back to the generic SERP form. */
export function buildSearchUrl(keywords: string, location: string, page: number): string {
  const kw = slugify(keywords);
  // Country-level "indonesia" has no SEEK slug — the national path covers it.
  const loc = slugify(location) === 'indonesia' ? '' : slugify(location);
  let path = '/id/jobs';
  if (kw && loc) path = `/id/${kw}-jobs/in-${loc}`;
  else if (kw) path = `/id/${kw}-jobs`;
  const params = new URLSearchParams();
  params.set('sortmode', 'ListedDate'); // newest first (verified live; rows carry relative-only times our display sort cannot parse)
  if (!kw) {
    if (keywords) params.set('keywords', keywords);
    if (location) params.set('where', location);
  }
  if (page > 1) params.set('page', String(page));
  const qs = params.toString();
  return `${BASE}${path}${qs ? `?${qs}` : ''}`;
}

/** Pure parser over one SERP HTML payload — unit-testable without network. */
export function parseJobstreetHtml(html: string): JobPosting[] {
  const $ = cheerio.load(html);
  $('style,script').remove();
  const out: JobPosting[] = [];
  const seen = new Set<string>();
  $('article[data-job-id]').each((_, el) => {
    const card = $(el);
    const id = card.attr('data-job-id') ?? '';
    if (!/^\d+$/.test(id) || seen.has(id)) return;
    const title = card.find('[data-automation="jobTitle"]').text().trim();
    if (!title) return;
    seen.add(id);
    const href = card.find('a[href*="/job/"]').first().attr('href') ?? `/id/job/${id}`;
    const dateText = card.find('[data-automation="jobListingDate"]').text().trim();
    const salary = card.find('[data-automation="jobSalary"]').text().trim();
    out.push({
      id,
      source: 'jobstreet',
      position: title,
      company:
        card.find('[data-automation="jobCompany"]').text().trim().replace(/^di\s+/i, '') ||
        'Company',
      location:
        card.find('[data-automation="jobCardLocation"]').text().trim() ||
        card.find('[data-automation="jobLocation"]').text().trim() ||
        'Indonesia',
      datetime: null, // SERP exposes only relative date text
      agoTime: dateText || 'recently',
      salary: salary || null,
      url: new URL(href, BASE).toString().split('#')[0]!,
      logo: card.find('[data-automation="company-logo"] img').attr('src') || null,
      description:
        card.find('[data-automation="jobShortDescription"]').text().trim().replace(/\s+/g, ' ') ||
        null,
    });
  });
  return out;
}

export async function searchJobstreet(
  query: FingerprintQuery,
  _fingerprint: string,
): Promise<JobPosting[]> {
  const cookie = cookieHeader(ENV, 'jobstreet');
  const limit = resultLimit(query.filters);
  const tokens = (query.keywords || '').toLowerCase().split(/\s+/).filter(Boolean);
  const locationFilter = (query.location || '').toLowerCase().trim();

  const out: JobPosting[] = [];
  const seen = new Set<string>();
  for (let page = 1; page <= MAX_PAGES && out.length < limit; page++) {
    const res = await fetch(buildSearchUrl(query.keywords || '', query.location || '', page), {
      headers: wafHeaders(cookie),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) {
      throw new Error(`Jobstreet search failed: HTTP ${res.status} (cookies may be expired)`);
    }
    const parsed = parseJobstreetHtml(await res.text());
    if (parsed.length === 0) break;
    let fresh = 0;
    for (const job of parsed) {
      if (seen.has(job.id)) continue;
      if (tokens.length > 0) {
        const hay = `${job.position} ${job.company} ${job.description ?? ''}`.toLowerCase();
        if (!tokens.every((t) => hay.includes(t))) continue;
      }
      if (locationFilter && !matchesLocation(job.location, locationFilter)) continue;
      seen.add(job.id);
      out.push(job);
      fresh++;
      if (out.length >= limit) break;
    }
    if (fresh === 0) break;
  }
  return out;
}
