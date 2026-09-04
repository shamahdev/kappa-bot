// LinkedIn Jobs Guest adapter (research-01/02).
// Polls GET /jobs-guest/jobs/api/seeMoreJobPostings/search (HTML fragments,
// `start` paging) + tiered backoff + per-fingerprint circuit breaker (ADR-0004).
// Compliant posture: sequential, ~2s jitter between pages, ≤3 pages/poll.

import * as cheerio from 'cheerio';
import type { FingerprintQuery, JobDetail, JobPosting } from '../types';

const BASE = 'https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const PAGE_SIZE = 10;
const MAX_PAGES = 3;
const MAX_RETRIES = 3;
const CIRCUIT_TTL_MS = 60 * 60 * 1000;

const circuitOpenUntil = new Map<string, number>();

export function circuitCount(): number {
  const now = Date.now();
  for (const [k, v] of circuitOpenUntil) if (v <= now) circuitOpenUntil.delete(k);
  return circuitOpenUntil.size;
}

export function buildSearchUrl(query: FingerprintQuery, start: number): string {
  const params = new URLSearchParams();
  if (query.keywords) params.set('keywords', query.keywords);
  if (query.geoId) params.set('geoId', query.geoId);
  else if (query.location) params.set('location', query.location);
  if (query.distance) params.set('distance', String(query.distance));
  for (const [k, v] of Object.entries(query.filters)) params.set(k, v);
  params.set('start', String(start));
  return `${BASE}?${params.toString()}`;
}

/** Pure parser over a guest HTML fragment — unit-testable without network. */
export function parseSearchHtml(html: string): JobPosting[] {
  const $ = cheerio.load(html);
  const jobs: JobPosting[] = [];
  $('li').each((_, el) => {
    const card = $(el);
    const position = card.find('.base-search-card__title').text().trim();
    const company = card.find('.base-search-card__subtitle').text().trim();
    if (!position || !company) return;
    const urn = card.find('[data-entity-urn]').attr('data-entity-urn') ?? '';
    const id = urn.split(':').pop() ?? '';
    if (!id) return;
    const href = card.find('.base-card__full-link').attr('href') ?? '';
    const url = href.split('?')[0] || `https://www.linkedin.com/jobs/view/${id}`;
    jobs.push({
      id,
      source: 'linkedin',
      position,
      company,
      location: card.find('.job-search-card__location').text().trim(),
      datetime: card.find('time').attr('datetime') ?? null,
      agoTime: card.find('time').text().trim(),
      salary: card.find('.job-search-card__salary-info').text().trim() || null,
      url,
      logo: card.find('.artdeco-entity-image').attr('data-delayed-url') ?? null,
    });
  });
  return jobs;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function jitter(baseMs: number): number {
  return baseMs + Math.floor(Math.random() * 1000);
}

class CircuitOpen extends Error {}

async function fetchPage(url: string, fingerprint: string): Promise<string> {
  let lastStatus = 0;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/html' } });
    lastStatus = res.status;
    if (res.ok) return await res.text();
    if (res.status === 429 || res.status === 999) {
      if (attempt === MAX_RETRIES) break;
      await sleep(jitter(2 ** attempt * 1000));
      continue;
    }
    if (res.status === 403 || res.status === 302) {
      // Cloudflare/bot challenge: one UA-rotated retry, then circuit-break.
      if (attempt === 0) {
        await sleep(5000);
        continue;
      }
      break;
    }
    if (res.status >= 500 && attempt === 0) {
      await sleep(jitter(1000));
      continue;
    }
    break;
  }
  circuitOpenUntil.set(fingerprint, Date.now() + CIRCUIT_TTL_MS);
  throw new CircuitOpen(`linkedin fetch failed (status ${lastStatus}); circuit open 60m for ${fingerprint}`);
}

export async function searchLinkedIn(query: FingerprintQuery, fingerprint: string): Promise<JobPosting[]> {
  const openUntil = circuitOpenUntil.get(fingerprint) ?? 0;
  if (openUntil > Date.now()) throw new CircuitOpen(`circuit open for ${fingerprint}`);
  const all: JobPosting[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const html = await fetchPage(buildSearchUrl(query, page * PAGE_SIZE), fingerprint);
    const jobs = parseSearchHtml(html);
    if (jobs.length === 0) break; // 200 + empty <li> = exhausted (success, not error)
    all.push(...jobs);
    if (page < MAX_PAGES - 1) await sleep(jitter(2000));
  }
  return all;
}

const DETAIL_BASE = 'https://www.linkedin.com/jobs-guest/jobs/api/jobPosting';

/** Detail HTML → plain text (title/company/location parsed by caller-side selectors). */
export function parseDetailHtml(html: string): JobDetail {
  const $ = cheerio.load(html);
  const description = $('div.show-more-less-html__markup').text().replace(/\s+/g, ' ').trim();
  const salary = $('[class*="salary"]').first().text().replace(/\s+/g, ' ').trim();
  return {
    description: description || null,
    salary: salary || null,
  };
}

/**
 * One polite detail fetch per NEW job (ADR-0005 correction: owner opted into
 * enrichment for personal use). Returns null on any failure — the embed then
 * renders card-only, delivery never blocks on detail.
 */
export async function fetchDetail(jobId: string): Promise<JobDetail | null> {
  try {
    await sleep(jitter(2000)); // research-02 cadence: ~1 req/2s
    const res = await fetch(`${DETAIL_BASE}/${jobId}`, {
      headers: { 'User-Agent': UA, Accept: 'text/html' },
    });
    if (!res.ok) return null;
    return parseDetailHtml(await res.text());
  } catch {
    return null;
  }
}
