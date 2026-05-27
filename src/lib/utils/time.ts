export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function isAfterHours(timestampSeconds: number): boolean {
  const date = new Date(timestampSeconds * 1000);
  const hour = date.getHours();
  return hour < 8 || hour >= 22;
}

export function windowStart(windowDays: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - windowDays);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function formatSeconds(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h`;
  return `${Math.round(seconds / 86400)}d`;
}
