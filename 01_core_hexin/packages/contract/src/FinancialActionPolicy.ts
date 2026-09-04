import { OperationCatalog, type OperationId } from './OperationCatalog';

export interface FinancialActionRequest {
  readonly operation: string;
  readonly path?: unknown;
  readonly query?: unknown;
  readonly body?: unknown;
}

const ACTION_PROOF_OPERATIONS = new Set<OperationId>([
  'referral.settings.manage',
  'referral.products.manage',
  'referral.withdrawals.create',
  'finance.statements.export',
  'finance.reconciliations.manage',
  'finance.reconciliationrepairs.submit',
  'finance.reconciliationrepairs.decide',
  'finance.reconciliationrepairs.reverse',
  'finance.settlements.decide',
  'finance.settlements.adjust',
  'finance.withdrawals.create',
  'finance.withdrawals.decide',
  'finance.withdrawals.recover',
  'finance.periods.manage',
  'finance.backfills.decide',
  'finance.policies.manage',
  'invoice.requests.decide',
  'invoice.requests.red',
]);

export function requiresFinancialActionProof(operation: string): boolean {
  return ACTION_PROOF_OPERATIONS.has(operation as OperationId);
}

export function requiresFinancialExpectedVersion(operation: string): boolean {
  try {
    return OperationCatalog.definition(operation).expectedVersion === 'required';
  } catch {
    return false;
  }
}

/**
 * Produces the single canonical representation used for both proof issuance
 * and the authoritative command request hash. Idempotency and version headers
 * intentionally stay outside this value because they are bound independently.
 */
export function canonicalFinancialActionRequest(request: FinancialActionRequest): string {
  if (!requiresFinancialActionProof(request.operation)) throw new Error('FINANCIAL_ACTION_REQUEST_INVALID');
  return JSON.stringify({
    operation: request.operation,
    path: stringRecord(request.path, false),
    query: stringRecord(request.query, true),
    body: jsonValue(request.body === undefined ? null : request.body),
  });
}

function stringRecord(value: unknown, query: boolean): Readonly<Record<string, string | readonly string[]>> {
  if (value === undefined) return Object.freeze({});
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('FINANCIAL_ACTION_REQUEST_INVALID');
  }
  const normalized: Record<string, string | readonly string[]> = {};
  for (const key of Object.keys(value).sort()) {
    const item: unknown = Reflect.get(value, key);
    if (query && (item === undefined || item === null)) continue;
    if (query && Array.isArray(item)) {
      if (!item.every((entry) => typeof entry === 'string')) throw new Error('FINANCIAL_ACTION_REQUEST_INVALID');
      normalized[key] = Object.freeze([...item]);
      continue;
    }
    if (query && (typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean')) {
      if (typeof item === 'number' && !Number.isFinite(item)) throw new Error('FINANCIAL_ACTION_REQUEST_INVALID');
      normalized[key] = String(item);
      continue;
    }
    if (typeof item !== 'string' || item.length === 0) throw new Error('FINANCIAL_ACTION_REQUEST_INVALID');
    normalized[key] = item;
  }
  return Object.freeze(normalized);
}

function jsonValue(value: unknown): unknown {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('FINANCIAL_ACTION_REQUEST_INVALID');
    return value;
  }
  if (Array.isArray(value)) return value.map(jsonValue);
  if (typeof value !== 'object') throw new Error('FINANCIAL_ACTION_REQUEST_INVALID');
  const normalized: Record<string, unknown> = {};
  for (const key of Object.keys(value).sort()) {
    const item: unknown = Reflect.get(value, key);
    if (item !== undefined) normalized[key] = jsonValue(item);
  }
  return normalized;
}
