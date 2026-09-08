export type StatementImportMetadata = Readonly<
  Record<string, unknown> & {
    readonly provider: string;
    readonly partnerId: string;
    readonly periodStart: string;
    readonly periodEnd: string;
    readonly currency: 'CNY';
    readonly openingMinor: number;
    readonly closingMinor: number;
  }
>;

export function statementImportMetadata(value: Readonly<Record<string, unknown>>): StatementImportMetadata {
  const periodStart = date(value.periodStart, 'FINANCE_IMPORT_PERIOD_INVALID');
  const periodEnd = date(value.periodEnd, 'FINANCE_IMPORT_PERIOD_INVALID');
  if (periodStart > periodEnd) throw new Error('FINANCE_IMPORT_PERIOD_INVALID');
  const currency = text(value.currency, 'FINANCE_IMPORT_CURRENCY_REQUIRED', 3);
  if (currency !== 'CNY') throw new Error('FINANCE_IMPORT_CURRENCY_UNSUPPORTED');
  return Object.freeze({
    provider: identifier(value.provider, 'FINANCE_IMPORT_PROVIDER_REQUIRED'),
    partnerId: text(value.partnerId, 'FINANCE_IMPORT_PARTNER_REQUIRED', 128),
    periodStart,
    periodEnd,
    currency,
    openingMinor: money(value.openingMinor, 'FINANCE_IMPORT_OPENING_INVALID'),
    closingMinor: money(value.closingMinor, 'FINANCE_IMPORT_CLOSING_INVALID'),
  });
}

function identifier(value: unknown, code: string): string {
  const result = text(value, code, 32);
  if (!/^[a-z][a-z0-9]{1,31}$/.test(result)) throw new Error(code);
  return result;
}

function date(value: unknown, code: string): string {
  const result = text(value, code, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result) || Number.isNaN(Date.parse(`${result}T00:00:00Z`))) throw new Error(code);
  return result;
}

function text(value: unknown, code: string, maximum: number): string {
  if (typeof value !== 'string' || !value.trim() || value.length > maximum) throw new Error(code);
  return value.trim();
}

function money(value: unknown, code: string): number {
  const result = Number(value);
  if (!Number.isSafeInteger(result)) throw new Error(code);
  return result;
}
