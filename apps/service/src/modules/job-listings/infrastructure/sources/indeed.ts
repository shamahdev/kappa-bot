// Indeed ID adapter (fetch + persisted WAF cookies — no browser).
// URL + field pattern learned from ifqygazhar/jobscraper-api scrape_indeed.py
// (`/jobs?q=&l=&start=`), but their `li.css-*` / `h2.jobTitle` selectors are
// stale — these use the stable hooks verified live 2026-09-08:
// `td.resultContent`, `a.jcs-JobTitle[data-jk]`, `span[title]`,
// `span[data-testid=company-name]`, `div[data-testid=text-location]`, and the
// per-job `hiringInsightsModel.age` ("4 hari yang lalu") from the mosaic JSON.
import * as cheerio from "cheerio";

import type { FingerprintQuery, JobPosting } from "../../domain/posting";
import { cookieHeader, wafHeaders } from "./cookies";
import { matchesLocation } from "./location";

const BASE = "https://id.indeed.com/jobs";
export const ENV = "INDEED_COOKIES";
const MAX_PAGES = 3;

export const resultLimit = (filters: Record<string, string>): number => {
  const n = Number(filters.limit);
  if (Number.isFinite(n)) {
    return Math.min(50, Math.max(1, Math.floor(n)));
  }
  return 20;
};

/** jk → posting age text, parsed from the mosaic JSON blob in the page. */
export const extractIndeedAges = (html: string): Map<string, string> => {
  const map = new Map<string, string>();
  const segments = html.split('"jobKey":"');
  for (const seg of segments.slice(1)) {
    const jk = seg.slice(0, 16);
    if (!/^[a-f0-9]{16}$/u.test(jk) || map.has(jk)) {
      continue;
    }
    // Age lives in the same job model, before the next jobKey segment.
    const nextKey = seg.indexOf('"jobKey":"');
    const scope = nextKey === -1 ? seg : seg.slice(0, nextKey);
    const age =
      scope.match(/"formattedRelativeTime":"(?<age>[^"]+)"/u)?.[1] ??
      scope.match(/"hiringInsightsModel":\{"age":"(?<age>[^"]+)"/u)?.[1];
    if (age) {
      map.set(jk, age);
    }
  }
  return map;
};

/** Pure parser over one SERP HTML payload — unit-testable without network. */
export const parseIndeedHtml = (html: string): JobPosting[] => {
  const ages = extractIndeedAges(html);
  const $ = cheerio.load(html);
  $("style,script").remove();
  const out: JobPosting[] = [];
  const seen = new Set<string>();
  $("td.resultContent").each((_, el) => {
    const card = $(el);
    const link = card.find("a.jcs-JobTitle[data-jk]").first();
    const jk = link.attr("data-jk") ?? "";
    const title =
      link.find("span[title]").attr("title")?.trim() ||
      link.text().trim() ||
      "";
    if (!(/^[a-f0-9]{16}$/u.test(jk) && title) || seen.has(jk)) {
      return;
    }
    seen.add(jk);
    const age = ages.get(jk) ?? null;
    out.push({
      agoTime: age ?? "recently",
      company:
        card.find('span[data-testid="company-name"]').text().trim() ||
        "Company",
      // SERP exposes only relative age text.
      datetime: null,
      description: null,
      id: jk,
      location:
        card
          .find('div[data-testid="text-location"]')
          .text()
          .trim()
          .replaceAll(/\s+/gu, " ") || "Indonesia",
      logo: null,
      position: title,
      salary: null,
      source: "indeed",
      url: `https://id.indeed.com/viewjob?jk=${jk}`,
    });
  });
  return out;
};

export const searchIndeed = async (
  query: FingerprintQuery,
  _fingerprint: string
): Promise<JobPosting[]> => {
  const cookie = cookieHeader(ENV, "indeed");
  const limit = resultLimit(query.filters);
  const tokens = (query.keywords || "")
    .toLowerCase()
    .split(/\s+/u)
    .filter(Boolean);
  const locationFilter = (query.location || "").toLowerCase().trim();

  const out: JobPosting[] = [];
  const seen = new Set<string>();
  for (let page = 0; page < MAX_PAGES && out.length < limit; page += 1) {
    const params = new URLSearchParams();
    if (query.keywords) {
      params.set("q", query.keywords);
    }
    if (query.location) {
      params.set("l", query.location);
    }
    params.set("sort", "date");
    params.set("fromage", "14");
    if (page > 0) {
      params.set("start", String(page * 10));
    }
    // Keep bounded page requests serial so deduplication and limits can stop pagination.
    // oxlint-disable-next-line no-await-in-loop
    const res = await fetch(`${BASE}?${params.toString()}`, {
      headers: wafHeaders(cookie),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) {
      throw new Error(
        `Indeed search failed: HTTP ${res.status} (cookies may be expired)`
      );
    }
    // Consume this page before deciding whether to request the next one.
    // oxlint-disable-next-line no-await-in-loop
    const parsed = parseIndeedHtml(await res.text());
    if (parsed.length === 0) {
      break;
    }
    let fresh = 0;
    for (const job of parsed) {
      if (seen.has(job.id)) {
        continue;
      }
      if (tokens.length > 0) {
        const hay = `${job.position} ${job.company}`.toLowerCase();
        if (!tokens.every((t) => hay.includes(t))) {
          continue;
        }
      }
      if (locationFilter && !matchesLocation(job.location, locationFilter)) {
        continue;
      }
      seen.add(job.id);
      out.push(job);
      fresh += 1;
      if (out.length >= limit) {
        break;
      }
    }
    if (fresh === 0) {
      // Pagination looping over seen cards.
      break;
    }
  }
  return out;
};
