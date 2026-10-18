const pad = (value: number): string => String(value).padStart(2, '0');

function toParts(value: Date | string | null | undefined): [string, string, string] | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      return null;
    }
    return [pad(value.getDate()), pad(value.getMonth() + 1), String(value.getFullYear())];
  }
  const str = String(value).trim();
  if (!str) {
    return null;
  }
  let match = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/);
  if (match) {
    return [pad(Number(match[3])), pad(Number(match[2])), match[1]];
  }
  match = str.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})/);
  if (match) {
    return [pad(Number(match[1])), pad(Number(match[2])), match[3]];
  }
  const fallback = new Date(str);
  if (!Number.isNaN(fallback.getTime())) {
    return [pad(fallback.getDate()), pad(fallback.getMonth() + 1), String(fallback.getFullYear())];
  }
  return null;
}

export function formatDate(date: Date | string | null | undefined): string {
  const parts = toParts(date);
  return parts ? `${parts[0]}/${parts[1]}/${parts[2]}` : '';
}

export function formatDateTime(date: Date | string | null | undefined): string {
  const parts = toParts(date);
  if (!parts) {
    return '';
  }
  const value = date instanceof Date ? date : new Date(String(date));
  if (Number.isNaN(value.getTime())) {
    return `${parts[0]}/${parts[1]}/${parts[2]}`;
  }
  return `${parts[0]}/${parts[1]}/${parts[2]} ${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}`;
}
