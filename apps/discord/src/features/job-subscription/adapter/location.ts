// Shared location matching for Tier 1 adapters, Indonesia-aware.
//
// Problem: ATS boards (Greenhouse/Lever/Ashby) and remote aggregators list
// locations as free text ("Jakarta, Indonesia", "Remote - Worldwide",
// "LATAM, Europe, USA, Canada, APAC"). A naive substring match on
// location=Indonesia misses two real cases:
//   1. ID-city postings ("Jakarta") when the filter says "Indonesia" and vice versa.
//   2. Worldwide/APAC-remote postings open to Indonesia applicants.
//
// Rule (deliberately narrow — a "Remote - European Union" role must NOT match
// an Indonesia filter):
//   - direct substring either way → match;
//   - Indonesia-ish filter ("indonesia" or any major ID city) ALSO matches a
//     location that is bare "remote" or mentions worldwide/anywhere/global/apac/asia.

const INDONESIA_TOKENS = [
  'indonesia',
  'jakarta',
  'bandung',
  'surabaya',
  'medan',
  'semarang',
  'makassar',
  'palembang',
  'tangerang',
  'bekasi',
  'depok',
  'bogor',
  'yogyakarta',
  'yogya',
  'solo',
  'surakarta',
  'malang',
  'denpasar',
  'bali',
  'batam',
  'pekanbaru',
  'padang',
  'pontianak',
  'balikpapan',
  'samarinda',
  'manado',
  'lombok',
  'jawabarat',
  'jawatimur',
  'jawatengah',
];

/** True when the subscriber's location filter targets Indonesia. */
export function isIndonesiaFilter(locationFilter: string): boolean {
  const f = locationFilter.toLowerCase().trim();
  if (!f) return false;
  return INDONESIA_TOKENS.some((t) => f.includes(t));
}

/** True when a job location is effectively open to Indonesia-based applicants. */
export function isIndonesiaOpenLocation(jobLocation: string): boolean {
  const loc = jobLocation.toLowerCase();
  if (!loc.trim() || loc.trim() === 'remote') return true;
  if (INDONESIA_TOKENS.some((t) => loc.includes(t))) return true;
  // Worldwide-remote phrasing. APAC/Asia included; EMEA/EU/US-only excluded.
  return /worldwide|anywhere\s*(\(worldwide\))?|global(ly)?\s*remote|remote\s*[-–:–]?\s*(worldwide|global|anywhere|apac|asia)|apac|asia(\s*[-–/]\s*pacific)?|open\s*to\s*.*(worldwide|anywhere|apac|asia)/.test(
    loc,
  );
}

/**
 * Location predicate shared by Tier 1 adapters. Empty filter matches all;
 * otherwise direct substring (either direction) wins, with the Indonesia
 * worldwide-remote fallback above.
 *
 * Set `remoteFallback=false` for EU-centric boards (Arbeitnow) where a bare
 * "Remote" location means remote-within-Europe, not worldwide.
 */
export function matchesLocation(
  jobLocation: string,
  locationFilter: string,
  remoteFallback = true,
): boolean {
  const filter = locationFilter.toLowerCase().trim();
  if (!filter) return true;
  const loc = (jobLocation || '').toLowerCase();
  if (!loc) return false;
  if (loc.includes(filter)) return true;
  // "jakarta, indonesia" filter vs "jakarta" location (and vice versa):
  // any significant token matching is enough. Tokens ≤2 chars are ignored
  // ("us", "eu", "id" cause false positives).
  const tokens = filter.split(/[\s,;]+/).filter((t) => t.length > 2);
  if (tokens.some((t) => loc.includes(t))) return true;
  if (remoteFallback && isIndonesiaFilter(filter) && isIndonesiaOpenLocation(jobLocation)) return true;
  return false;
}
