export class Dimension {
  constructor(
    readonly name: string,
    readonly value: string
  ) {
    if (!/^[a-z][A-Za-z0-9]*$/.test(name) || !value || value.length > 255) throw new Error('REPORT_DIMENSION_INVALID');
    Object.freeze(this);
  }
}

export function dimensionRecord(value: Readonly<Record<string, string>>): Readonly<Record<string, string>> {
  const entries = Object.entries(value).map(([name, item]) => {
    const dimension = new Dimension(name, item);
    return [dimension.name, dimension.value] as const;
  });
  return Object.freeze(Object.fromEntries(entries));
}

export function dimensionNames(value: readonly string[]): readonly string[] {
  const names = value.map((name) => new Dimension(name, 'definition').name);
  if (new Set(names).size !== names.length) throw new Error('REPORT_DIMENSION_DUPLICATE');
  return Object.freeze(names);
}

export function timezoneName(value: string): string {
  if (!value || value.length > 100) throw new Error('REPORT_TIMEZONE_INVALID');
  try {
    new Intl.DateTimeFormat('en', { timeZone: value }).format(new Date(0));
  } catch {
    throw new Error('REPORT_TIMEZONE_INVALID');
  }
  return value;
}
