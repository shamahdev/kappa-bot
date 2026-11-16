// Existing HTTP pagination allowances; defaults differ by endpoint.
export const MAX_API_PAGE_SIZE = 100;
export const DEFAULT_JOB_PAGE_SIZE = 20;
export const DEFAULT_CV_REPORT_PAGE_SIZE = 50;

export const positiveIntegerParam = (
  raw: string | undefined,
  fallback: number
): number | null => {
  if (raw === undefined) {
    return fallback;
  }
  if (!/^\d+$/u.test(raw)) {
    return null;
  }
  const value = Number(raw);
  return Number.isSafeInteger(value) && value > 0 ? value : null;
};
