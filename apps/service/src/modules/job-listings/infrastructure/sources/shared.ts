export const resultLimit = (filters: Record<string, string>): number => {
  const n = Number(filters.limit);
  if (Number.isFinite(n)) {
    return Math.min(50, Math.max(1, Math.floor(n)));
  }
  return 20;
};

export const keywordTokens = (keywords: string): string[] =>
  keywords.toLowerCase().split(/\s+/u).filter(Boolean);

export const matchesKeywords = (tokens: string[], text: string): boolean => {
  const haystack = text.toLowerCase();
  return tokens.every((token) => haystack.includes(token));
};

export const formatAgo = (dateString: string | null | undefined): string => {
  const timestamp = dateString ? Date.parse(dateString) : Number.NaN;
  if (Number.isNaN(timestamp)) {
    return "recently";
  }
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 60) {
    return "just now";
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  }
  const days = Math.floor(hours / 24);
  if (days < 7) {
    return `${days} day${days === 1 ? "" : "s"} ago`;
  }
  const weeks = Math.floor(days / 7);
  if (weeks < 5) {
    return `${weeks} week${weeks === 1 ? "" : "s"} ago`;
  }
  const months = Math.floor(days / 30);
  if (months < 12) {
    return `${months} month${months === 1 ? "" : "s"} ago`;
  }
  const years = Math.floor(days / 365);
  return `${years} year${years === 1 ? "" : "s"} ago`;
};

export const stripHtml = (html: string | null | undefined): string | null => {
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
