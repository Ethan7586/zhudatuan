import * as Operation from '@shop/contract/ids';
import type { VoucherOperation, VoucherRecord } from './Voucher';

export interface VoucherAction {
  readonly operation: VoucherOperation;
  readonly record?: VoucherRecord;
}

const dangerousOperations = new Set<VoucherOperation>([
  Operation.OP_VOUCHER_PRODUCTS_DISABLE,
  Operation.OP_VOUCHER_STOCKREQUESTS_CANCEL,
  Operation.OP_VOUCHER_ISSUEORDERS_CANCEL,
  Operation.OP_VOUCHER_VOUCHERS_UNBIND,
  Operation.OP_VOUCHER_REFUNDS_CREATE,
]);

export function voucherRecordOperations(record?: VoucherRecord): readonly VoucherOperation[] {
  if (!record) return Object.freeze([]);
  if (record.kind === 'products') return record.state === 'enabled'
    ? Object.freeze([Operation.OP_VOUCHER_PRODUCTS_REVISE, Operation.OP_VOUCHER_PRODUCTS_DISABLE])
    : Object.freeze([Operation.OP_VOUCHER_PRODUCTS_REVISE, Operation.OP_VOUCHER_PRODUCTS_ENABLE]);
  if (record.kind === 'pools') return record.state === 'open'
    ? Object.freeze([Operation.OP_VOUCHER_CREDENTIALS_GENERATE, Operation.OP_VOUCHER_CREDENTIALS_IMPORT, Operation.OP_VOUCHER_CREDENTIALPOOLS_CLOSE])
    : Object.freeze([]);
  if (record.kind === 'stocks') return record.state === 'draft'
    ? Object.freeze([Operation.OP_VOUCHER_STOCKREQUESTS_UPDATE, Operation.OP_VOUCHER_STOCKREQUESTS_SUBMIT, Operation.OP_VOUCHER_STOCKREQUESTS_CANCEL])
    : record.state === 'submitted' ? Object.freeze([Operation.OP_VOUCHER_STOCKREQUESTS_CANCEL]) : Object.freeze([]);
  if (record.kind === 'issues') return record.state === 'draft'
    ? Object.freeze([Operation.OP_VOUCHER_ISSUEORDERS_UPDATE, Operation.OP_VOUCHER_ISSUEORDERS_SUBMIT, Operation.OP_VOUCHER_ISSUEORDERS_CANCEL])
    : Object.freeze([Operation.OP_VOUCHER_ISSUEORDEREXPORTS_CREATE]);
  if (record.kind === 'actions') return record.state === 'failed'
    ? Object.freeze([Operation.OP_VOUCHER_ACTIONBATCHES_RETRY, Operation.OP_VOUCHER_ACTIONEXPORTS_CREATE])
    : Object.freeze([Operation.OP_VOUCHER_ACTIONEXPORTS_CREATE]);
  if (record.kind === 'redemptions') return record.state === 'refunded' ? Object.freeze([]) : Object.freeze([Operation.OP_VOUCHER_REFUNDS_CREATE]);
  if (record.kind === 'vouchers' || record.kind === 'search') return record.raw.holder
    ? Object.freeze([Operation.OP_VOUCHER_VOUCHERS_UNBIND, Operation.OP_VOUCHER_REDEMPTIONS_QUOTE])
    : Object.freeze([Operation.OP_VOUCHER_VOUCHERS_BIND, Operation.OP_VOUCHER_REDEMPTIONS_QUOTE]);
  return Object.freeze([]);
}

export function isDangerousVoucherOperation(operation: VoucherOperation): boolean {
  return dangerousOperations.has(operation);
}
