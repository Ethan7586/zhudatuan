export function localTime(value: string | Date): string {
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function calendarRange(start: string, end: string): string {
  const first = calendarDate(start);
  const last = calendarDate(end);
  if (first === null || last === null) return '—';
  if (first.year === last.year && first.month === last.month) return `${first.year}年${first.month}月${first.day}–${last.day}日`;
  if (first.year === last.year) return `${first.year}年${first.month}月${first.day}日–${last.month}月${last.day}日`;
  return `${first.year}年${first.month}月${first.day}日–${last.year}年${last.month}月${last.day}日`;
}

function calendarDate(value: string): Readonly<{ year: number; month: number; day: number }> | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value);
  if (match === null) return null;
  return Object.freeze({ year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) });
}
