// Kalibrr Southeast Asia job board adapter.
// Public search API: GET https://www.kalibrr.com/api/job_board/search
import type { FingerprintQuery, JobPosting } from "../../domain/posting";

const BASE = "https://www.kalibrr.com/api/job_board/search";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

const formatAgo = (dateString: string | null | undefined): string => {
  if (!dateString) {
    return "recently";
  }
  const t = Date.parse(dateString);
  if (Number.isNaN(t)) {
    return "recently";
  }
  const sec = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (sec < 60) {
    return "just now";
  }
  const min = Math.floor(sec / 60);
  if (min < 60) {
    return `${min} minute${min === 1 ? "" : "s"} ago`;
  }
  const hr = Math.floor(min / 60);
  if (hr < 24) {
    return `${hr} hour${hr === 1 ? "" : "s"} ago`;
  }
  const day = Math.floor(hr / 24);
  if (day < 7) {
    return `${day} day${day === 1 ? "" : "s"} ago`;
  }
  const week = Math.floor(day / 7);
  if (week < 5) {
    return `${week} week${week === 1 ? "" : "s"} ago`;
  }
  const month = Math.floor(day / 30);
  if (month < 12) {
    return `${month} month${month === 1 ? "" : "s"} ago`;
  }
  const year = Math.floor(day / 365);
  return `${year} year${year === 1 ? "" : "s"} ago`;
};

const stripHtml = (html: string | null | undefined): string | null => {
  if (!html) {
    return null;
  }
  return (
    html
      .replaceAll(/<br\s*\/?>/giu, "\n")
      .replaceAll(/<\/p>/giu, "\n\n")
      .replaceAll(/<\/li>/giu, "\n")
      .replaceAll(/<li[^>]*>/giu, "• ")
      .replaceAll(/<[^>]+>/gu, "")
      .replaceAll("&nbsp;", " ")
      .replaceAll("&amp;", "&")
      .replaceAll("&lt;", "<")
      .replaceAll("&gt;", ">")
      .replaceAll("&quot;", '"')
      .replaceAll("&#39;", "'")
      .replaceAll(/\n{3,}/gu, "\n\n")
      .trim() || null
  );
};

const formatSalary = (
  min?: number | null,
  max?: number | null,
  currency?: string | null
): string | null => {
  // Parameter defaults only cover undefined; preserve fallback for null and empty currency codes too.
  // oxlint-disable-next-line unicorn/prefer-default-parameters
  const curr = currency || "IDR";
  if (min && max) {
    return `${curr} ${min.toLocaleString("en-US")} - ${max.toLocaleString("en-US")}`;
  }
  if (min) {
    return `${curr} ${min.toLocaleString("en-US")}+`;
  }
  if (max) {
    return `Up to ${curr} ${max.toLocaleString("en-US")}`;
  }
  return null;
};

interface KalibrrRawJob {
  id: number;
  name: string;
  company?: {
    name?: string;
    code?: string;
    logo?: string;
  };
  company_info?: {
    code?: string;
    logo?: string;
  };
  google_location?: {
    address_components?: {
      city?: string;
      province?: string;
      country?: string;
    };
  };
  offline_locations?: string[];
  activation_date?: string;
  salary_min?: number;
  salary_max?: number;
  salary_currency?: string;
  url_path?: string;
  description?: string;
}

const jobLocation = (j: KalibrrRawJob): string =>
  j.google_location?.address_components?.city ||
  j.offline_locations?.[0] ||
  j.google_location?.address_components?.country ||
  "Indonesia";

export const searchKalibrr = async (
  query: FingerprintQuery,
  _fingerprint: string
): Promise<JobPosting[]> => {
  const params = new URLSearchParams();
  params.set("country", query.filters.country || "Indonesia");
  if (query.keywords) {
    params.set("text", query.keywords);
  }
  // Country-level location ("Indonesia") is already covered by `country` — the
  // API matches `location` against city-level values, so sending it would
  // wrongly empty the result set. Only forward city-level filters.
  if (query.location && query.location.trim().toLowerCase() !== "indonesia") {
    params.set("location", query.location);
  }
  params.set("limit", query.filters.limit || "20");

  for (const [k, v] of Object.entries(query.filters)) {
    if (k !== "country" && k !== "limit") {
      params.set(k, v);
    }
  }

  const url = `${BASE}?${params.toString()}`;
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": UA,
    },
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    throw new Error(
      `Kalibrr search failed: HTTP ${res.status} ${res.statusText}`
    );
  }

  const data = (await res.json()) as { jobs?: KalibrrRawJob[] };
  const rawJobs = data.jobs || [];

  return rawJobs.map((j): JobPosting => {
    const companyName = j.company?.name || "Company";
    const companyCode = j.company?.code || j.company_info?.code || "c";
    const location = jobLocation(j);
    const fullUrl = j.url_path
      ? `https://www.kalibrr.com${j.url_path}`
      : `https://www.kalibrr.com/c/${companyCode}/jobs/${j.id}`;

    return {
      agoTime: formatAgo(j.activation_date),
      company: companyName,
      datetime: j.activation_date ?? null,
      description: stripHtml(j.description),
      id: String(j.id),
      location,
      logo: j.company_info?.logo || j.company?.logo || null,
      position: j.name,
      salary: formatSalary(j.salary_min, j.salary_max, j.salary_currency),
      source: "kalibrr",
      url: fullUrl,
    };
  });
};
