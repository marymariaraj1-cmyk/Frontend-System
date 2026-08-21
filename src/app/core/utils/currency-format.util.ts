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
