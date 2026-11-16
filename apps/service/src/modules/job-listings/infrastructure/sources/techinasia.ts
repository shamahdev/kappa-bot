// Tech in Asia jobs adapter.
// Public API: GET https://www.techinasia.com/api/2.0/job-postings
import type { FingerprintQuery, JobPosting } from "../../domain/posting";
import { matchesLocation } from "./location";
import { formatAgo, stripHtml, keywordTokens, matchesKeywords } from "./shared";

const BASE = "https://www.techinasia.com/api/2.0/job-postings";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const MAX_PAGES = 2;

const formatSalary = (
  min?: number | null,
  max?: number | null,
  currency?: { currency_code?: string; currency_symbol?: string } | null
): string | null => {
  const curr = currency?.currency_code || "IDR";
  if (min && min > 0 && max && max > 0) {
    return `${curr} ${min.toLocaleString("en-US")} - ${max.toLocaleString("en-US")}`;
  }
  if (min && min > 0) {
    return `${curr} ${min.toLocaleString("en-US")}+`;
  }
  if (max && max > 0) {
    return `Up to ${curr} ${max.toLocaleString("en-US")}`;
  }
  return null;
};

interface TiaRawJob {
  id: string;
  title: string;
  company?: {
    name?: string;
    logo_url?: string;
  };
  job_locations?: {
    location?: {
      name?: string;
    };
  }[];
  published_at?: string;
  created_at?: string;
  salary_min?: number;
  salary_max?: number;
  currency?: {
    currency_code?: string;
    currency_symbol?: string;
  };
  description?: string;
}

export const searchTechInAsia = async (
  query: FingerprintQuery,
  _fingerprint: string
): Promise<JobPosting[]> => {
  const country = query.filters.country || "Indonesia";
  const allRawJobs: TiaRawJob[] = [];

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const params = new URLSearchParams();
    params.set("country_name", country);
    params.set("page", String(page));

    // Keep bounded page requests serial, including the existing first-page failure policy.
    // oxlint-disable-next-line no-await-in-loop
    const res = await fetch(`${BASE}?${params.toString()}`, {
      headers: {
        Accept: "application/json",
        "User-Agent": UA,
      },
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      if (page === 1) {
        throw new Error(
          `Tech in Asia search failed: HTTP ${res.status} ${res.statusText}`
        );
      }
      break;
    }

    // An empty response ends pagination before any further request.
    // oxlint-disable-next-line no-await-in-loop
    const data = (await res.json()) as { data?: TiaRawJob[] };
    const pageJobs = data.data || [];
    allRawJobs.push(...pageJobs);
    if (pageJobs.length === 0) {
      break;
    }
  }

  const tokens = keywordTokens(query.keywords || "");
  const locationFilter = (query.location || "").toLowerCase().trim();

  const filtered = allRawJobs.filter((j) => {
    const titleLower = (j.title || "").toLowerCase();
    const descLower = (j.description || "").toLowerCase();
    const companyLower = (j.company?.name || "").toLowerCase();

    if (tokens.length > 0) {
      const matchesKeyword = matchesKeywords(
        tokens,
        `${titleLower} ${descLower} ${companyLower}`
      );
      if (!matchesKeyword) {
        return false;
      }
    }

    if (locationFilter) {
      const locNames = (j.job_locations || [])
        .map((l) => l.location?.name?.toLowerCase() || "")
        .join(" ");
      // Blank location payload inherits the server-side country scope, so an
      // Indonesia filter keeps these rows instead of dropping the whole page.
      const locForMatch = locNames.trim() ? locNames : country.toLowerCase();
      const matchesLocationFilter =
        matchesLocation(locForMatch, locationFilter) ||
        titleLower.includes(locationFilter);
      if (!matchesLocationFilter) {
        return false;
      }
    }

    return true;
  });

  return filtered.map((j): JobPosting => {
    const companyName = j.company?.name || "Company";
    // Jobs with no location payload inherit the server-side country scope
    // (country_name=Indonesia) — otherwise ID postings with blank locations
    // are wrongly filtered out and render with an empty location.
    const loc =
      (j.job_locations || [])
        .map((l) => l.location?.name)
        .filter((n): n is string => Boolean(n))
        .join(", ") || country;
    const published = j.published_at || j.created_at || null;

    return {
      agoTime: formatAgo(published),
      company: companyName,
      datetime: published,
      description: stripHtml(j.description),
      id: j.id,
      location: loc,
      logo: j.company?.logo_url || null,
      position: j.title,
      salary: formatSalary(j.salary_min, j.salary_max, j.currency),
      salaryData: {
        currency: j.currency?.currency_code ?? null,
        max: j.salary_max ?? null,
        min: j.salary_min ?? null,
        period: null,
      },
      source: "techinasia",
      url: `https://www.techinasia.com/jobs/${j.id}`,
    };
  });
};
