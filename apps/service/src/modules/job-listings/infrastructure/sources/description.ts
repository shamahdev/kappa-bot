import { URL } from "node:url";

import * as cheerio from "cheerio";

import type { JobDetail, JobPosting } from "../../domain/posting";
import { stripHtml } from "./shared";

const SOURCE_HOSTS: Record<string, string[]> = {
  glints: ["glints.com"],
  indeed: ["id.indeed.com"],
  jobstreet: ["id.jobstreet.com"],
  kalibrr: ["www.kalibrr.com", "kalibrr.com"],
  linkedin: ["www.linkedin.com", "linkedin.com"],
  techinasia: ["www.techinasia.com", "techinasia.com"],
};

export const parsePostingDescription = (html: string): string | null => {
  const $ = cheerio.load(html);
  const descriptions: string[] = [];
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) {
      for (const item of value) {
        visit(item);
      }
    } else if (value && typeof value === "object") {
      const node = value as Record<string, unknown>;
      const types = Array.isArray(node["@type"])
        ? node["@type"]
        : [node["@type"]];
      if (
        types.includes("JobPosting") &&
        typeof node.description === "string"
      ) {
        const text = stripHtml(node.description);
        if (text) {
          descriptions.push(text);
        }
      }
      if (node["@graph"]) {
        visit(node["@graph"]);
      }
    }
  };
  $('script[type="application/ld+json"]').each((_, element) => {
    try {
      visit(JSON.parse($(element).text()));
    } catch {
      // Ignore malformed unrelated structured data.
    }
  });
  if (descriptions.length) {
    return descriptions.join("\n\n");
  }
  const selected = $(
    "#jobDescriptionText, [data-automation='jobAdDetails'], [data-testid='job-description'], .show-more-less-html__markup, [itemprop='description']"
  ).first();
  return stripHtml(selected.html());
};

/** Restrict redirects as well as initial URLs to the posting's canonical source. */
const hasPostingMarkup = (html: string): boolean =>
  /"@type"\s*:\s*(?:"JobPosting"|\[[^\]]*"JobPosting")/u.test(html) ||
  /id=["']jobDescriptionText["']|data-automation=["']jobAdDetails["']|data-testid=["']job-description["']|itemprop=["']description["']/u.test(
    html
  );

const isSourceUrl = (url: URL, source: string): boolean =>
  url.protocol === "https:" &&
  !url.username &&
  !url.password &&
  (!url.port || url.port === "443") &&
  Boolean(SOURCE_HOSTS[source]?.includes(url.hostname));

export const fetchOriginalDescription = async (
  job: JobPosting,
  headers?: NonNullable<Parameters<typeof fetch>[1]>["headers"],
  signal = AbortSignal.timeout(15_000),
  request: typeof fetch = fetch
): Promise<JobDetail> => {
  let url = new URL(job.url);
  for (let redirect = 0; redirect <= 3; redirect += 1) {
    if (!isSourceUrl(url, job.source)) {
      throw new Error("Unsupported posting URL");
    }
    // Redirects must be checked before fetching the next URL.
    // oxlint-disable-next-line no-await-in-loop
    const response = await request(url.toString(), {
      headers,
      redirect: "manual",
      signal,
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) {
        throw new Error("Posting redirect has no destination");
      }
      url = new URL(location, url);
      continue;
    }
    if (response.status === 404 || response.status === 410) {
      return { closed: true, description: null, salary: job.salary };
    }
    if (!response.ok) {
      throw new Error(`Posting description HTTP ${response.status}`);
    }
    // Consume only the validated source response.
    // oxlint-disable-next-line no-await-in-loop
    const html = await response.text();
    const description = parsePostingDescription(html);
    // A challenge/login page is a fetch failure, not evidence of unspecified facts.
    if (
      !description &&
      /captcha|verify you are human|access denied|just a moment|sign in to continue/iu.test(
        html
      )
    ) {
      throw new Error("Posting description unavailable");
    }
    if (!description && !hasPostingMarkup(html)) {
      throw new Error("Posting description markup not recognized");
    }
    return { closed: false, description, salary: job.salary };
  }
  throw new Error("Too many posting redirects");
};
