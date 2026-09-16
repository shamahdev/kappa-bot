// In-process counters/gauges (ADR-0006 baseline). No exporter here: the HTTP
// listener moved to apps/service (spec §8), so these are write-only until a
// future scrape path ships. Kept because supervisor + schedule instrument into them.

const counters = new Map<string, number>();
const gauges = new Map<string, number>();

export function incCounter(name: string, labels: Record<string, string> = {}, by = 1): void {
  const key = `${name}{${Object.entries(labels)
    .map(([k, v]) => `${k}="${v}"`)
    .join(',')}}`;
  counters.set(key, (counters.get(key) ?? 0) + by);
}

export function setGauge(name: string, value: number, labels: Record<string, string> = {}): void {
  const key = `${name}{${Object.entries(labels)
    .map(([k, v]) => `${k}="${v}"`)
    .join(',')}}`;
  gauges.set(key, value);
}

export function renderMetrics(): string {
  const lines: string[] = [];
  for (const [key, value] of counters) lines.push(`${key} ${value}`);
  for (const [key, value] of gauges) lines.push(`${key} ${value}`);
  return `${lines.join('\n')}\n`;
}
