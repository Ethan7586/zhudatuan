export interface NormalizedStatementLine {
  readonly reference: string;
  readonly kind: 'payment' | 'refund';
  readonly amount: number;
  readonly tax: number;
  readonly currency: string;
  readonly occurred: string | null;
}

export function statementLine(value: Readonly<Record<string, string>>, expectedCurrency: string): NormalizedStatementLine {
  const kind = value.type;
  if (kind !== 'payment' && kind !== 'refund') throw new Error('FINANCE_IMPORT_TYPE_INVALID');
  if (value.currency && value.currency !== expectedCurrency) throw new Error('FINANCE_IMPORT_CURRENCY_UNSUPPORTED');
  const timestamp = value.occurredAt ? Date.parse(value.occurredAt) : null;
  if (timestamp !== null && Number.isNaN(timestamp)) throw new Error('FINANCE_IMPORT_OCCURRED_INVALID');
  return Object.freeze({
    reference: text(value.reference, 'FINANCE_IMPORT_REFERENCE_REQUIRED', 256),
    kind,
    amount: positive(value.amountMinor, 'FINANCE_IMPORT_AMOUNT_INVALID'),
    tax: value.taxMinor ? unsigned(value.taxMinor, 'FINANCE_IMPORT_TAX_INVALID') : 0,
    currency: expectedCurrency,
    occurred: timestamp === null ? null : new Date(timestamp).toISOString(),
  });
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

function positive(value: unknown, code: string): number {
  const result = money(value, code);
  if (result <= 0) throw new Error(code);
  return result;
}

function unsigned(value: unknown, code: string): number {
  const result = money(value, code);
  if (result < 0) throw new Error(code);
  return result;
}
