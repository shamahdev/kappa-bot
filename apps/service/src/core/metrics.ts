// Process-local metrics; the service HTTP endpoint does not aggregate other processes.

const counters = new Map<string, number>();
const gauges = new Map<string, number>();

export const incCounter = (
  name: string,
  labels: Record<string, string> = {},
  by = 1
): void => {
  const key = `${name}{${Object.entries(labels)
    .map(([k, v]) => `${k}="${v}"`)
    .join(",")}}`;
  counters.set(key, (counters.get(key) ?? 0) + by);
};

export const setGauge = (
  name: string,
  value: number,
  labels: Record<string, string> = {}
): void => {
  const key = `${name}{${Object.entries(labels)
    .map(([k, v]) => `${k}="${v}"`)
    .join(",")}}`;
  gauges.set(key, value);
};

export const renderMetrics = (): string => {
  const lines: string[] = [];
  for (const [key, value] of counters) {
    lines.push(`${key} ${value}`);
  }
  for (const [key, value] of gauges) {
    lines.push(`${key} ${value}`);
  }
  return `${lines.join("\n")}\n`;
};
