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
