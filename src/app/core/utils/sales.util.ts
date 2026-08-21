export const DECIMAL_PATTERN = /^\d+(\.\d+)?$/;

export function isDecimal(value: string | null | undefined): boolean {
  if (value === null || value === undefined) {
    return false;
  }
  return DECIMAL_PATTERN.test(value.trim());
}

export function calculateTotal(weight: number, price: number): number {
  if (weight === null || weight === undefined || price === null || price === undefined) {
    return 0;
  }
  return Math.round(weight * price * 100) / 100;
}

export function formatApiDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

const pad = (value: number): string => String(value).padStart(2, '0');
