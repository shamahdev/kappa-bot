/**
 * Only absolute http(s) URLs may become clickable links. Scraped postings can
 * carry arbitrary schemes; rendering them directly would allow script URLs.
 */
const HTTP_URL = /^https?:\/\/[^\s]+$/iu;

export const safeHttpUrl = (value: string): string | null => {
  const trimmed = value.trim();
  return HTTP_URL.test(trimmed) ? trimmed : null;
};
