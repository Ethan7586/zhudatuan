import type { OperationResult } from '../../../../foundation/application/OperationHandler';
import type { OperationAction, OperationActions } from '../../../../foundation/application/ModuleOperations';
import { requireAccess } from '../../../../foundation/application/ModuleOperations';

export function getReconciliationRepairOperations(): OperationActions {
  const actions: Readonly<Record<string, OperationAction>> = {
    'finance.reconciliationrepairs.read': async (request, database) => {
      const access = requireAccess(request);
      const repair = request.input.path.repairid;
      if (typeof repair !== 'string' || repair.length === 0 || repair.length > 255) throw new Error('VALIDATION_FAILED:repairid');
      const result = await database.query<{ receipt: unknown }>(`select finance.read_reconciliation_repair($1,$2) receipt`, [repair, access.scope.id]);
      return receiptResult(result);
    },
  };
  return actions;
}

function receiptResult(result: Readonly<{ rows: readonly ReceiptRow[] }>): OperationResult {
  const receipt = result.rows[0]?.receipt;
  if (!isRecord(receipt)) throw new Error('CONTRACT_RESPONSE_INVALID:finance.reconciliationrepair');
  const repair = isRecord(receipt.repair) ? receipt.repair : receipt;
  const version = repair.version;
  if (!isVersion(version)) throw new Error('CONTRACT_RESPONSE_INVALID:finance.reconciliationrepair.version');
  return { status: 200, body: receipt, headers: { etag: `\"${String(version)}\"` } };
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isVersion(value: unknown): value is number | string {
  return (Number.isSafeInteger(value) && (value as number) >= 0) || (typeof value === 'string' && /^(0|[1-9][0-9]*)$/.test(value));
}

type ReceiptRow = { receipt: unknown };
