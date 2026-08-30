import type { OperationRequest, OperationResult } from '../../../../foundation/application/OperationHandler';
import type { OperationAction, OperationActions, OperationDatabase } from '../../../../foundation/application/ModuleOperations';
import { operationRequestHash, requireAccess } from '../../../../foundation/application/ModuleOperations';
import { bodyRecord, integerField, textField } from '../../../../foundation/interface/Validation';

const INTERNAL_JOURNAL_MISSING = 'INTERNAL_JOURNAL_MISSING';
const previewFields = Object.freeze(new Set(['reason', 'evidence', 'itemVersion']));
const submitFields = Object.freeze(new Set(['previewHash']));
const decideFields = Object.freeze(new Set(['decision', 'reason', 'evidence']));
const reverseFields = Object.freeze(new Set(['reason']));

export function reconciliationRepairOperations(): OperationActions {
  const actions: Readonly<Record<string, OperationAction>> = {
    'finance.reconciliationrepairs.preview': previewRepair,
    'finance.reconciliationrepairs.submit': submitRepair,
    'finance.reconciliationrepairs.decide': decideRepair,
    'finance.reconciliationrepairs.reverse': reverseRepair,
  };
  return actions;
}

const previewRepair: OperationAction = async (request, database) => {
  const access = requireAccess(request);
  const body = strictBody(request, previewFields);
  const reason = textField(body, 'reason', 64);
  if (reason !== INTERNAL_JOURNAL_MISSING) throw new Error('FINANCE_REPAIR_REASON_UNSUPPORTED');
  const result = await database.query<ReceiptRow>(`select finance.preview_reconciliation_repair($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb) receipt`, [
    pathIdentifier(request, 'reconciliationid'),
    pathIdentifier(request, 'itemid'),
    access.scope.id,
    access.actor.id,
    idempotency(request),
    expectedVersion(request),
    integerField(body, 'itemVersion'),
    reason,
    JSON.stringify(objectField(body, 'evidence')),
  ]);
  return receiptResult(result, 201);
};

const submitRepair: OperationAction = async (request, database) => {
  const access = requireAccess(request);
  const body = strictBody(request, submitFields);
  const result = await database.query<ReceiptRow>(`select finance.submit_reconciliation_repair($1,$2,$3,$4,$5,$6,$7) receipt`, [
    pathIdentifier(request, 'repairid'),
    access.scope.id,
    access.actor.id,
    idempotency(request),
    expectedVersion(request),
    hashField(body, 'previewHash'),
    operationRequestHash(request),
  ]);
  return receiptResult(result);
};

const decideRepair: OperationAction = async (request, database) => {
  const access = requireAccess(request);
  const body = strictBody(request, decideFields);
  const decision = body.decision === 'approve' ? 'approve' : body.decision === 'reject' ? 'reject' : null;
  if (!decision) throw new Error('FINANCE_REPAIR_DECISION_INVALID');
  const result = await database.query<ReceiptRow>(`select finance.decide_reconciliation_repair($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9) receipt`, [
    pathIdentifier(request, 'repairid'),
    access.scope.id,
    access.actor.id,
    idempotency(request),
    expectedVersion(request),
    decision,
    textField(body, 'reason', 1000),
    JSON.stringify(objectField(body, 'evidence')),
    operationRequestHash(request),
  ]);
  return receiptResult(result);
};

const reverseRepair: OperationAction = async (request, database) => {
  const access = requireAccess(request);
  const body = strictBody(request, reverseFields);
  const result = await database.query<ReceiptRow>(`select finance.reverse_reconciliation_repair($1,$2,$3,$4,$5,$6,$7) receipt`, [
    pathIdentifier(request, 'repairid'),
    access.scope.id,
    access.actor.id,
    idempotency(request),
    expectedVersion(request),
    textField(body, 'reason', 1000),
    operationRequestHash(request),
  ]);
  return receiptResult(result);
};

function receiptResult(result: Readonly<{ rows: readonly ReceiptRow[] }>, status = 200): OperationResult {
  const receipt = result.rows[0]?.receipt;
  if (!isRecord(receipt)) throw new Error('CONTRACT_RESPONSE_INVALID:finance.reconciliationrepair');
  const repair = isRecord(receipt.repair) ? receipt.repair : receipt;
  const version = repair.version;
  if (!isVersion(version)) throw new Error('CONTRACT_RESPONSE_INVALID:finance.reconciliationrepair.version');
  return { status, body: receipt, headers: { etag: `\"${String(version)}\"` } };
}

function strictBody(request: OperationRequest, allowed: ReadonlySet<string>): Readonly<Record<string, unknown>> {
  const body = bodyRecord(request);
  const unexpected = Object.keys(body).find((field) => !allowed.has(field));
  if (unexpected) throw new Error(`VALIDATION_FAILED:unexpected:${unexpected}`);
  return body;
}

function objectField(body: Readonly<Record<string, unknown>>, field: string): Readonly<Record<string, unknown>> {
  const value = body[field];
  if (!isRecord(value)) throw new Error(`VALIDATION_FAILED:${field}`);
  try {
    JSON.stringify(value);
  } catch {
    throw new Error(`VALIDATION_FAILED:${field}`);
  }
  return value;
}

function hashField(body: Readonly<Record<string, unknown>>, field: string): string {
  const value = textField(body, field, 64);
  if (!/^[0-9a-f]{64}$/.test(value)) throw new Error(`VALIDATION_FAILED:${field}`);
  return value;
}

function pathIdentifier(request: OperationRequest, field: string): string {
  const value = request.input.path[field];
  if (typeof value !== 'string' || value.length === 0 || value.length > 255) throw new Error(`VALIDATION_FAILED:${field}`);
  return value;
}

function idempotency(request: OperationRequest): string {
  const value = request.input.idempotency;
  if (typeof value !== 'string' || value.length === 0 || value.length > 255) throw new Error('IDEMPOTENCY_KEY_REQUIRED');
  return value;
}

function expectedVersion(request: OperationRequest): number {
  const value = request.input.expectedVersion;
  if (!Number.isSafeInteger(value) || (value as number) < 0) throw new Error('EXPECTED_VERSION_REQUIRED');
  return value as number;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isVersion(value: unknown): value is number | string {
  return (Number.isSafeInteger(value) && (value as number) >= 0) || (typeof value === 'string' && /^(0|[1-9][0-9]*)$/.test(value));
}

type ReceiptRow = { receipt: unknown };
