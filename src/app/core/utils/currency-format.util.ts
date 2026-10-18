import { roundOff } from './round-off.util';

export function formatCurrency(value: number | null | undefined | string): string {
  if (value === null || value === undefined) {
    return '₹ 0.00';
  }
  const numeric = typeof value === 'string' ? Number(value.trim()) : value;
  if (Number.isNaN(numeric)) {
    return '₹ 0.00';
  }
  const rounded = roundOff(numeric);
  const formatted = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(rounded);
  return `₹ ${formatted}`;
}

/**
 * Highest number of decimal places used by the given column values (capped at 2).
 * Lets a footer total adopt the same precision as the values above it, so
 * right-aligned digits line up instead of differing in width.
 */
export function maxDecimalPlaces(
  values: ReadonlyArray<string | number | null | undefined>,
): number {
  let max = 0;
  for (const value of values) {
    if (value === null || value === undefined) {
      continue;
    }
    const text = String(value).trim();
    const dot = text.indexOf('.');
    if (dot === -1) {
      continue;
    }
    const decimals = text.length - dot - 1;
    if (decimals > max) {
      max = decimals;
    }
  }
  return Math.min(max, 2);
}

/** Formats a total using the given decimal precision, matching its column values. */
export function formatTotalWithPrecision(value: number, decimals: number): string {
  if (!Number.isFinite(value)) {
    return decimals > 0 ? (0).toFixed(decimals) : '0';
  }
  const places = Math.max(0, Math.min(decimals, 2));
  return value.toFixed(places);
}
