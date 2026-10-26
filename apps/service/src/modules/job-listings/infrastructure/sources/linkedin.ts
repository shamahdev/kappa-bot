// LinkedIn Jobs Guest adapter.
// Polls GET /jobs-guest/jobs/api/seeMoreJobPostings/search (HTML fragments,
// `start` paging) + tiered backoff + per-fingerprint circuit breaker.
// Compliant posture: sequential, ~2s jitter between pages, ≤3 pages/poll.

import { setTimeout as delay } from "node:timers/promises";

import * as cheerio from "cheerio";

import type {
  FingerprintQuery,
  JobDetail,
  JobPosting,
} from "../../domain/posting";

const BASE =
  "https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search";
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const PAGE_SIZE = 10;
const MAX_PAGES = 3;
const MAX_RETRIES = 3;
const CIRCUIT_TTL_MS = 60 * 60 * 1000;
/** LinkedIn f_TPR value for "past month" (30 days). */
const PAST_MONTH_TPR = "r2592000";
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const AGO_RE =
  /(?<amount>\d+)\s+(?<unit>second|minute|hour|day|week|month|year)s?\s+ago/iu;
const CLOSED_RE =
  /no longer accepting applications|this job is closed|job has been (?:closed|filled)|position has been filled|no longer available/iu;

const circuitOpenUntil = new Map<string, number>();

export const linkedinCircuitCount = (): number => {
  const now = Date.now();
  for (const [k, v] of circuitOpenUntil) {
    if (v <= now) {
      circuitOpenUntil.delete(k);
    }
  }
  return circuitOpenUntil.size;
};

export const buildSearchUrl = (
  query: FingerprintQuery,
  start: number
): string => {
  const params = new URLSearchParams();
  if (query.keywords) {
    params.set("keywords", query.keywords);
  }
  if (query.geoId) {
    params.set("geoId", query.geoId);
  } else if (query.location) {
    params.set("location", query.location);
  }
  if (query.distance) {
    params.set("distance", String(query.distance));
  }
  // Deliveries are under-a-month-only: default to LinkedIn's own past-month
  // window unless the subscription pinned an explicit f_TPR. Injected at URL
  // build time, not fingerprinted, so existing subs/dedup keep their key.
  if (!query.filters.f_TPR) {
    params.set("f_TPR", PAST_MONTH_TPR);
  }
  for (const [k, v] of Object.entries(query.filters)) {
    params.set(k, v);
  }
  params.set("start", String(start));
  return `${BASE}?${params.toString()}`;
};

/**
 * Client-side backstop for the f_TPR window: only postings demonstrably < 1
 * month old pass. Card <time datetime> wins; ago text ("2 weeks ago") is the
 * fallback. Unknown age (no datetime, unparseable text) is dropped — the
 * subscription contract is under-a-month-only.
 */
export const isRecent = (
  job: Pick<JobPosting, "datetime" | "agoTime">,
  now = Date.now()
): boolean => {
  if (job.datetime) {
    const t = Date.parse(job.datetime);
    if (!Number.isNaN(t)) {
      return now - t <= MAX_AGE_MS;
    }
  }
  const ago = job.agoTime.trim().toLowerCase();
  if (/just now|^now$|^today$/u.test(ago)) {
    return true;
  }
  const m = AGO_RE.exec(ago);
  if (!m) {
    return false;
  }
  const unit = m[2].toLowerCase();
  if (unit === "month" || unit === "year") {
    // "1 month ago" is not under a month.
    return false;
  }
  if (unit === "week") {
    return Number(m[1]) * 7 <= 30;
  }
  if (unit === "day") {
    return Number(m[1]) <= 30;
  }
  // Seconds/minutes/hours are under a month.
  return true;
};

/** Pure parser over a guest HTML fragment — unit-testable without network. */
export const parseSearchHtml = (html: string): JobPosting[] => {
  const $ = cheerio.load(html);
  const jobs: JobPosting[] = [];
  $("li").each((_, el) => {
    const card = $(el);
    const position = card.find(".base-search-card__title").text().trim();
    const company = card.find(".base-search-card__subtitle").text().trim();
    if (!(position && company)) {
      return;
    }
    const urn = card.find("[data-entity-urn]").attr("data-entity-urn") ?? "";
    const id = urn.split(":").pop() ?? "";
    if (!id) {
      return;
    }
    const href = card.find(".base-card__full-link").attr("href") ?? "";
    const url =
      href.split("?")[0] || `https://www.linkedin.com/jobs/view/${id}`;
    jobs.push({
      agoTime: card.find("time").text().trim(),
      company,
      datetime: card.find("time").attr("datetime") ?? null,
      id,
      location: card.find(".job-search-card__location").text().trim(),
      logo: card.find(".artdeco-entity-image").attr("data-delayed-url") ?? null,
      position,
      salary: card.find(".job-search-card__salary-info").text().trim() || null,
      source: "linkedin",
      url,
    });
  });
  return jobs;
};

const sleep = (ms: number): Promise<void> => delay(ms);

const jitter = (baseMs: number): number =>
  baseMs + Math.floor(Math.random() * 1000);

class CircuitOpenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CircuitOpenError";
  }
}

const fetchPage = async (url: string, fingerprint: string): Promise<string> => {
  let lastStatus = 0;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    // Retries depend on the preceding status and must obey the backoff below.
    // oxlint-disable-next-line no-await-in-loop
    const res = await fetch(url, {
      headers: { Accept: "text/html", "User-Agent": UA },
    });
    lastStatus = res.status;
    if (res.ok) {
      // Return the successful response body before any retry can begin.
      // oxlint-disable-next-line no-await-in-loop
      return await res.text();
    }
    if (res.status === 429 || res.status === 999) {
      if (attempt === MAX_RETRIES) {
        break;
      }
      // Required exponential backoff before this fingerprint's next retry.
      // oxlint-disable-next-line no-await-in-loop
      await sleep(jitter(2 ** attempt * 1000));
      continue;
    }
    if (res.status === 403 || res.status === 302) {
      // Cloudflare/bot challenge: one UA-rotated retry, then circuit-break.
      if (attempt === 0) {
        // The challenge retry must wait before issuing another external request.
        // oxlint-disable-next-line no-await-in-loop
        await sleep(5000);
        continue;
      }
      break;
    }
    if (res.status >= 500 && attempt === 0) {
      // Preserve the existing server-error backoff before retrying.
      // oxlint-disable-next-line no-await-in-loop
      await sleep(jitter(1000));
      continue;
    }
    break;
  }
  circuitOpenUntil.set(fingerprint, Date.now() + CIRCUIT_TTL_MS);
  throw new CircuitOpenError(
    `linkedin fetch failed (status ${lastStatus}); circuit open 60m for ${fingerprint}`
  );
};

export const searchLinkedIn = async (
  query: FingerprintQuery,
  fingerprint: string,
  dependencies: { fetchPage?: typeof fetchPage; sleep?: typeof sleep } = {}
): Promise<JobPosting[]> => {
  const readPage = dependencies.fetchPage ?? fetchPage;
  const pause = dependencies.sleep ?? sleep;
  const openUntil = circuitOpenUntil.get(fingerprint) ?? 0;
  if (openUntil > Date.now()) {
    throw new CircuitOpenError(`circuit open for ${fingerprint}`);
  }
  const all: JobPosting[] = [];
  for (let page = 0; page < MAX_PAGES; page += 1) {
    // Keep bounded pagination serial, stopping on an empty page.
    // oxlint-disable-next-line no-await-in-loop
    const html = await readPage(
      buildSearchUrl(query, page * PAGE_SIZE),
      fingerprint
    );
    const jobs = parseSearchHtml(html);
    if (jobs.length === 0) {
      // 200 + empty <li> = exhausted (success, not error).
      break;
    }
    all.push(...jobs);
    if (page < MAX_PAGES - 1) {
      // Polite inter-page delay is required before the next external request.
      // oxlint-disable-next-line no-await-in-loop
      await pause(jitter(2000));
    }
  }
  return all.filter((job) => isRecent(job));
};

const DETAIL_BASE = "https://www.linkedin.com/jobs-guest/jobs/api/jobPosting";

/**
 * Detail HTML → plain text + closed flag. Closed banners sit outside the
 * description markup, so the description text is stripped before matching to
 * avoid false positives on jobs whose text merely mentions those phrases.
 */
export const parseDetailHtml = (html: string): JobDetail => {
  const $ = cheerio.load(html);
  const description = $("div.show-more-less-html__markup")
    .text()
    .replaceAll(/\s+/gu, " ")
    .trim();
  const salary = $('[class*="salary"]')
    .first()
    .text()
    .replaceAll(/\s+/gu, " ")
    .trim();
  const outer = html.replace(description ?? "", "");
  return {
    closed: CLOSED_RE.test(outer),
    description: description || null,
    salary: salary || null,
  };
};

/**
 * One polite detail fetch per job being enriched. Returns null on any failure
 * so delivery can fall back to the listing row.
 */
export const fetchDetail = async (jobId: string): Promise<JobDetail | null> => {
  try {
    // Keep detail requests at ~1 req/2s.
    await sleep(jitter(2000));
    const res = await fetch(`${DETAIL_BASE}/${jobId}`, {
      headers: { Accept: "text/html", "User-Agent": UA },
    });
    if (!res.ok) {
      return null;
    }
    return parseDetailHtml(await res.text());
  } catch {
    return null;
  }
};
