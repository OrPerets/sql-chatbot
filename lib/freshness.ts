export type FreshnessLabel = "fresh" | "aging" | "stale" | "unknown";

function normalizeDate(value: Date | string | null | undefined): Date | null {
  if (!value) {
    return null;
  }

  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function getFreshnessScore(
  value: Date | string | null | undefined,
  options?: {
    freshHours?: number;
    staleHours?: number;
  }
): number {
  const date = normalizeDate(value);
  if (!date) {
    return 0;
  }

  const ageHours = Math.max(0, (Date.now() - date.getTime()) / (1000 * 60 * 60));
  const freshHours = Math.max(1, options?.freshHours ?? 48);
  const staleHours = Math.max(freshHours + 1, options?.staleHours ?? 24 * 14);

  if (ageHours <= freshHours) {
    return 1;
  }

  if (ageHours >= staleHours) {
    return 0;
  }

  return Number((1 - (ageHours - freshHours) / (staleHours - freshHours)).toFixed(3));
}

export function getFreshnessLabel(score: number): FreshnessLabel {
  if (!Number.isFinite(score)) {
    return "unknown";
  }

  if (score <= 0) {
    return "stale";
  }

  if (score >= 0.67) {
    return "fresh";
  }

  if (score >= 0.34) {
    return "aging";
  }

  return "stale";
}
