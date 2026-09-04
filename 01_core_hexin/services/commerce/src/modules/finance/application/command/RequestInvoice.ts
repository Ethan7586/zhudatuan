import { randomUUID } from 'node:crypto';
import type { OperationActions } from '../../../../foundation/application/ModuleOperations';
import { requireAccess, rowResult } from '../../../../foundation/application/ModuleOperations';
import type { OperationRequest } from '../../../../foundation/application/OperationHandler';
import { bodyRecord, integerField, textField } from '../../../../foundation/interface/Validation';
import type { FinanceRepositoryFactory } from '../port/FinanceRepository';

export function requestInvoiceOperations(repository: FinanceRepositoryFactory): OperationActions {
  return {
    'invoice.requests.create': requestInvoice,
    'invoice.requests.cancel': cancelInvoice,
    'invoice.requests.decide': (request, database) => decideInvoice(request, database, repository),
    'invoice.requests.red': redInvoice,
  };
}

const requestInvoice: NonNullable<OperationActions['invoice.requests.create']> = async (request, database) => {
  requireAccess(request);
  const body = bodyRecord(request);
  const id = `invoice:${randomUUID()}`;
  const amount = integerField(body, 'amountMinor', 1);
  const settlement = textField(body, 'settlement');
  const lines = identifiers(body.lines, 'lines');
  const result = await database.query(`select * from invoice.create_request($1,$2,$3,$4,$5::text[],$6,$7::jsonb,$8)`, [
    id,
    textField(body, 'profile'),
    settlement,
    amount,
    lines,
    textField(body, 'reason', 1000),
    JSON.stringify(record(body.evidence)),
    request.input.expectedVersion!,
  ]);
  if (!(result.rows[0] as { id?: string } | undefined)?.id) throw new Error('INVOICE_PROFILE_OR_SETTLEMENT_INVALID');
  return rowResult(result, 201);
};

const cancelInvoice: NonNullable<OperationActions['invoice.requests.cancel']> = async (request, database) => {
  requireAccess(request);
  const result = await database.query<{ id: string }>(`select * from invoice.cancel_request($1,$2)`, [request.input.path.requestid!, request.input.expectedVersion!]);
  return rowResult(result);
};

async function decideInvoice(request: OperationRequest, database: Parameters<FinanceRepositoryFactory>[0], repository: FinanceRepositoryFactory) {
  const access = requireAccess(request);
  const body = bodyRecord(request);
  const decision = body.decision === 'approved' ? 'approved' : body.decision === 'rejected' ? 'rejected' : null;
  if (!decision) throw new Error('INVOICE_DECISION_INVALID');
  const result = await database.query(`select * from invoice.decide_request($1,$2,$3,$4::jsonb,$5)`, [
    request.input.path.requestid!,
    decision,
    textField(body, 'reason', 1000),
    JSON.stringify(record(body.evidence)),
    request.input.expectedVersion!,
  ]);
  if (!result.rows[0]) throw new Error('INVOICE_DECISION_CONFLICT_OR_SEPARATION');
  if (decision === 'approved') await repository(database).enqueue('invoice', access.scope.id, { request: request.input.path.requestid! }, `job:invoice:${request.input.path.requestid!}`, true);
  return rowResult(result, decision === 'approved' ? 202 : 200);
}

const redInvoice: NonNullable<OperationActions['invoice.requests.red']> = async (request, database) => {
  requireAccess(request);
  const body = bodyRecord(request);
  const id = `invoice:red:${randomUUID()}`;
  const result = await database.query(`select * from invoice.create_red_request($1,$2,$3,$4::jsonb,$5)`, [
    id,
    request.input.path.requestid!,
    textField(body, 'reason', 1000),
    JSON.stringify(record(body.evidence)),
    request.input.expectedVersion!,
  ]);
  if (!result.rows[0]) throw new Error('INVOICE_RED_NOT_ELIGIBLE');
  return rowResult(result, 201);
};
function identifiers(value: unknown, field: string): readonly string[] {
  if (!Array.isArray(value)) throw new Error(`VALIDATION_FAILED:${field}`);
  const values = value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean)
    .sort();
  if (values.length === 0 || values.length > 1_000 || new Set(values).size !== values.length) throw new Error(`VALIDATION_FAILED:${field}`);
  return values;
}
function record(value: unknown): Readonly<Record<string, unknown>> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Readonly<Record<string, unknown>>) : {};
}
