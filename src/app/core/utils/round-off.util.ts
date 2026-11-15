export function roundOff(value: number | null | undefined): number {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return 0;
  }
  const abs = Math.abs(value);
  const whole = Math.floor(abs);
  const fraction = abs - whole;
  const roundedAbs = fraction >= 0.6 ? whole + 1 : whole;
  return value < 0 ? -roundedAbs : roundedAbs;
}

export function formatDecimal(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return '0.00';
  }
  const num = Number(value);
  if (Number.isNaN(num)) {
    return '0.00';
  }
  return (Math.round((num + Number.EPSILON) * 100) / 100).toFixed(2);
}

/**
 * Formats a weight for display without forcing a fixed number of decimals.
 * The value is shown exactly as supplied: "10" stays "10", "10.05" stays
 * "10.05" and "10.500" keeps its trailing zeros. Numeric totals are rounded
 * to at most three decimals to avoid floating-point artefacts.
 */
export function formatWeight(value: number | string | null | undefined): string {
  if (value === null || value === undefined) {
    return '0';
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '' || Number.isNaN(Number(trimmed))) {
      return '0';
    }
    return trimmed;
  }
  if (Number.isNaN(value)) {
    return '0';
  }
  const rounded = Math.round((value + Number.EPSILON) * 1000) / 1000;
  return String(rounded);
}

/**
 * Formats a stored weight with exactly three decimal places. Used for ledger,
 * report, popup and dashboard displays where the value comes from the database
 * and should keep its canonical 3-decimal form (0.450 stays 0.450).
 */
export function formatWeightFixed(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') {
    return '0.000';
  }
  const num = Number(value);
  if (Number.isNaN(num)) {
    return '0.000';
  }
  return (Math.round((num + Number.EPSILON) * 1000) / 1000).toFixed(3);
}

/**
 * Highest number of decimal places used by the given weight values (capped at 3).
 * Lets a footer total adopt the precision the user actually typed, so a row of
 * "10.500" keeps three decimals in the total while "10" stays a whole number.
 */
export function maxWeightDecimalPlaces(
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
  return Math.min(max, 3);
}

/** Formats a computed weight total with the given number of decimals (0-3). */
export function formatWeightTotal(value: number | null | undefined, decimals: number): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return decimals > 0 ? (0).toFixed(decimals) : '0';
  }
  const places = Math.max(0, Math.min(decimals, 3));
  return value.toFixed(places);
}
