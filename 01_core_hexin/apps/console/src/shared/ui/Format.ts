export function formatMinor(value: number, currency = 'CNY'): string {
  return new Intl.NumberFormat('zh-CN', { style: 'currency', currency }).format(value / 100);
}

export function formatDate(value: string | null | undefined): string {
  if (value === null || value === undefined) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('zh-CN', { hour12: false });
}

export function formatCount(value: number): string {
  return new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 0 }).format(value);
}
