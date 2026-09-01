import { DomainError } from '../../../../foundation/domain/DomainError';

export interface RequestedLine {
  readonly lineId: string;
  readonly quantity: number;
}

export function queryValue(value: string | readonly string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim().slice(0, 255) ?? '';
}

export function requestedLines(raw: unknown): readonly RequestedLine[] {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 50) throw new DomainError('VALIDATION_FAILED', { field: 'lines' });
  const lines = raw.map((value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new DomainError('VALIDATION_FAILED', { field: 'lines' });
    const item = value as Record<string, unknown>;
    if (typeof item.lineId !== 'string' || !Number.isSafeInteger(item.quantity) || Number(item.quantity) <= 0) throw new DomainError('VALIDATION_FAILED', { field: 'lines' });
    return Object.freeze({ lineId: item.lineId, quantity: Number(item.quantity) });
  });
  if (new Set(lines.map(({ lineId }) => lineId)).size !== lines.length) throw new DomainError('VALIDATION_FAILED', { field: 'lines' });
  return Object.freeze(lines.sort((left, right) => left.lineId.localeCompare(right.lineId)));
}
