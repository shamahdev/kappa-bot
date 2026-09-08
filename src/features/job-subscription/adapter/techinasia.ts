// Tech in Asia jobs adapter.
// Public API: GET https://www.techinasia.com/api/2.0/job-postings
import type { FingerprintQuery, JobPosting } from '../types';
import { matchesLocation } from './location';

const BASE = 'https://www.techinasia.com/api/2.0/job-postings';
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const MAX_PAGES = 2; // fetch up to 2 pages (50 recent tech JobPostings)

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

function stripHtml(html: string | null | undefined): string | null {
  if (!html) return null;
  return (
    html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<\/li>/gi, '\n')
      .replace(/<li[^>]*>/gi, '• ')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\n{3,}/g, '\n\n')
      .trim() || null
  );
}

function formatSalary(
  min?: number | null,
  max?: number | null,
  currency?: { currency_code?: string; currency_symbol?: string } | null,
): string | null {
  const curr = currency?.currency_code || 'IDR';
  if (min && min > 0 && max && max > 0) {
    return `${curr} ${min.toLocaleString('en-US')} - ${max.toLocaleString('en-US')}`;
  }
  if (min && min > 0) {
    return `${curr} ${min.toLocaleString('en-US')}+`;
  }
  if (max && max > 0) {
    return `Up to ${curr} ${max.toLocaleString('en-US')}`;
  }
  return null;
}

type TiaRawJob = {
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
};

export async function searchTechInAsia(
  query: FingerprintQuery,
  _fingerprint: string,
): Promise<JobPosting[]> {
  const country = query.filters.country || 'Indonesia';
  const allRawJobs: TiaRawJob[] = [];

  for (let page = 1; page <= MAX_PAGES; page++) {
    const params = new URLSearchParams();
    params.set('country_name', country);
    params.set('page', String(page));

    const res = await fetch(`${BASE}?${params.toString()}`, {
      headers: {
        'User-Agent': UA,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      if (page === 1) {
        throw new Error(`Tech in Asia search failed: HTTP ${res.status} ${res.statusText}`);
      }
      break;
    }

    const data = (await res.json()) as { data?: TiaRawJob[] };
    const pageJobs = data.data || [];
    allRawJobs.push(...pageJobs);
    if (pageJobs.length === 0) break;
  }

  const keywordTokens = (query.keywords || '')
    .toLowerCase()
    .split(/\s+/)
    .filter((k) => k.length > 0);
  const locationFilter = (query.location || '').toLowerCase().trim();

  const filtered = allRawJobs.filter((j) => {
    const titleLower = (j.title || '').toLowerCase();
    const descLower = (j.description || '').toLowerCase();
    const companyLower = (j.company?.name || '').toLowerCase();
    const locationNames = (j.job_locations || [])
      .map((l) => l.location?.name?.toLowerCase() || '')
      .join(' ');

    if (keywordTokens.length > 0) {
      const matchesKeyword = keywordTokens.every(
        (token) =>
          titleLower.includes(token) ||
          descLower.includes(token) ||
          companyLower.includes(token),
      );
      if (!matchesKeyword) return false;
    }

    if (locationFilter) {
      const locNames = (j.job_locations || [])
        .map((l) => l.location?.name?.toLowerCase() || '')
        .join(' ');
      // Blank location payload inherits the server-side country scope, so an
      // Indonesia filter keeps these rows instead of dropping the whole page.
      const locForMatch = locNames.trim() ? locNames : country.toLowerCase();
      const matchesLocationFilter =
        matchesLocation(locForMatch, locationFilter) || titleLower.includes(locationFilter);
      if (!matchesLocationFilter) return false;
    }

    return true;
  });

  return filtered.map((j): JobPosting => {
    const companyName = j.company?.name || 'Company';
    // Jobs with no location payload inherit the server-side country scope
    // (country_name=Indonesia) — otherwise ID postings with blank locations
    // are wrongly filtered out and render with an empty location.
    const loc =
      (j.job_locations || [])
        .map((l) => l.location?.name)
        .filter((n): n is string => Boolean(n))
        .join(', ') || country;
    const published = j.published_at || j.created_at || null;

    return {
      id: j.id,
      source: 'techinasia',
      position: j.title,
      company: companyName,
      location: loc,
      datetime: published,
      agoTime: formatAgo(published),
      salary: formatSalary(j.salary_min, j.salary_max, j.currency),
      url: `https://www.techinasia.com/jobs/${j.id}`,
      logo: j.company?.logo_url || null,
      description: stripHtml(j.description),
    };
  });
}

