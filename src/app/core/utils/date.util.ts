const pad = (value: number): string => String(value).padStart(2, '0');

export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) {
    return '';
  }
  const value = new Date(date);
  if (Number.isNaN(value.getTime())) {
    return '';
  }
  return `${pad(value.getDate())}-${pad(value.getMonth() + 1)}-${value.getFullYear()} ${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}`;
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) {
    return '';
  }
  const value = new Date(date);
  if (Number.isNaN(value.getTime())) {
    return '';
  }
  return `${pad(value.getDate())}-${pad(value.getMonth() + 1)}-${value.getFullYear()}`;
}
