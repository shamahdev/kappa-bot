const DAY_MS = 86_400_000;
const relative = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

/** "today", "yesterday", "3 days ago", then a short date once it's older than a week. */
export const relativeDay = (iso: string, now = Date.now()): string => {
  const time = Date.parse(iso);
  if (Number.isNaN(time)) {
    return iso;
  }
  const days = Math.floor(now / DAY_MS) - Math.floor(time / DAY_MS);
  // A week is the natural unit where relative days stop being easier to read.
  if (days >= 0 && days < 7) {
    return relative.format(-days, "day");
  }
  return new Date(time).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
};

export const fullDate = (iso: string): string =>
  new Date(iso).toLocaleDateString(undefined, { dateStyle: "medium" });
