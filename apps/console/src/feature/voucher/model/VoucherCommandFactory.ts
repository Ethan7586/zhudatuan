import * as Operation from '@shop/contract/ids';
import type { VoucherAction } from './VoucherAction';
import type { VoucherCommand, VoucherOperation } from './Voucher';
import { voucherOperationMeta } from './VoucherOperationCatalog';

export function createVoucherCommand(action: VoucherAction, values: Readonly<Record<string, string>>, identity: string): VoucherCommand {
  const operation = action.operation;
  const target = action.record?.id ?? optional(values.target);
  const body = commandBody(operation, values);
  const path = commandPath(operation, target);
  const input = Object.freeze({ ...(path ? { path } : {}), ...(body ? { body } : {}) });
  const meta = voucherOperationMeta(operation);
  const expectedVersion = action.record?.version ?? natural(values.expectedVersion);
  if (meta.expectedVersion && expectedVersion === undefined) throw new Error('VOUCHER_EXPECTED_VERSION_REQUIRED');
  const proof = optional(values.proof);
  if (meta.proof && !proof) throw new Error('VOUCHER_ACTION_PROOF_REQUIRED');
  return Object.freeze({
    operation,
    input,
    options: Object.freeze({ identity, ...(expectedVersion === undefined ? {} : { expectedVersion }), ...(proof ? { proof } : {}) }),
  });
}

function commandBody(operation: VoucherOperation, value: Readonly<Record<string, string>>): Readonly<Record<string, unknown>> | undefined {
  if (operation === Operation.OP_VOUCHER_PRODUCTS_CREATE || operation === Operation.OP_VOUCHER_PRODUCTS_REVISE) return product(value);
  if (operation === Operation.OP_VOUCHER_PRODUCTS_ENABLE || operation === Operation.OP_VOUCHER_PRODUCTS_DISABLE || operation === Operation.OP_VOUCHER_CREDENTIALPOOLS_CLOSE ||
      operation === Operation.OP_VOUCHER_STOCKREQUESTS_SUBMIT || operation === Operation.OP_VOUCHER_STOCKREQUESTS_CANCEL || operation === Operation.OP_VOUCHER_ISSUEORDERS_SUBMIT ||
      operation === Operation.OP_VOUCHER_ISSUEORDERS_CANCEL || operation === Operation.OP_VOUCHER_ISSUEBATCHES_RETRY || operation === Operation.OP_VOUCHER_ACTIONBATCHES_RETRY ||
      operation === Operation.OP_VOUCHER_VOUCHERS_UNBIND || operation === Operation.OP_VOUCHER_TENDERHOLDS_RELEASE) return { reason: required(value.reason, 'VOUCHER_REASON_REQUIRED') };
  if (operation === Operation.OP_VOUCHER_CREDENTIALPOOLS_CREATE) return { product: required(value.product), name: required(value.name), mode: one(value.mode, ['generated', 'imported']), prefix: required(value.prefix), capacity: positive(value.capacity) };
  if (operation === Operation.OP_VOUCHER_CREDENTIALS_GENERATE) return { count: positive(value.count) };
  if (operation === Operation.OP_VOUCHER_CREDENTIALS_IMPORT) return { upload: required(value.upload), fileHash: sha256(value.fileHash), fileName: required(value.fileName), mediaType: one(value.mediaType, ['text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']), size: positive(value.size) };
  if (operation === Operation.OP_VOUCHER_CREDENTIALEXPORTS_CREATE) return { pool: required(value.pool), reason: required(value.reason), watermark: instant(value.watermark) };
  if (operation === Operation.OP_VOUCHER_STOCKREQUESTS_CREATE || operation === Operation.OP_VOUCHER_STOCKREQUESTS_UPDATE) return stock(value);
  if (operation === Operation.OP_VOUCHER_ISSUEORDERS_CREATE || operation === Operation.OP_VOUCHER_ISSUEORDERS_UPDATE) return issue(value);
  if (operation === Operation.OP_VOUCHER_ISSUEORDEREXPORTS_CREATE) return { order: required(value.order), reason: required(value.reason) };
  if (operation === Operation.OP_VOUCHER_ACTIONBATCHES_CREATE) return { snapshot: required(value.snapshot), action: one(value.action, ['activate', 'disable', 'enable', 'void', 'extend']), reason: required(value.reason), ...(optional(value.expiresAt) ? { expiresAt: instant(value.expiresAt) } : {}) };
  if (operation === Operation.OP_VOUCHER_ACTIONEXPORTS_CREATE) return { batch: required(value.batch), reason: required(value.reason) };
  if (operation === Operation.OP_VOUCHER_ACTIVATIONS_SECRET) return { secret: required(value.secret) };
  if (operation === Operation.OP_VOUCHER_ACTIVATIONS_NUMBERSECRET) return { number: required(value.number), secret: required(value.secret) };
  if (operation === Operation.OP_VOUCHER_VOUCHERS_BIND) return { member: required(value.member), reason: required(value.reason) };
  if (operation === Operation.OP_VOUCHER_REDEMPTIONS_QUOTE) return { voucher: required(value.voucher), amountMinor: minor(value.amount), ...(optional(value.order) ? { order: value.order } : {}) };
  if (operation === Operation.OP_VOUCHER_TENDERHOLDS_CREATE) return { voucher: required(value.voucher), owner: required(value.owner), amountMinor: minor(value.amount), ttlSeconds: positive(value.ttl) };
  if (operation === Operation.OP_VOUCHER_TENDERHOLDS_CONSUME) return { verification: required(value.verification), ...(optional(value.order) ? { order: value.order } : {}) };
  if (operation === Operation.OP_VOUCHER_REDEMPTIONS_CREATE) return { voucher: required(value.voucher), hold: required(value.hold), verification: required(value.verification), amountMinor: minor(value.amount), ...(optional(value.order) ? { order: value.order } : {}) };
  if (operation === Operation.OP_VOUCHER_REFUNDS_CREATE) return { amountMinor: minor(value.amount), reason: required(value.reason) };
  if (operation === Operation.OP_VOUCHER_SEARCHSNAPSHOTS_CREATE) return { filter: compact({ query: value.query, product: value.product, pool: value.pool, customer: value.customer, holder: value.holder, state: value.state }) };
  if (operation === Operation.OP_VOUCHER_SEARCHEXPORTS_CREATE) return { snapshot: required(value.snapshot), reason: required(value.reason) };
  return undefined;
}

function commandPath(operation: VoucherOperation, candidate: string | undefined): Readonly<Record<string, string>> | undefined {
  if (operation === Operation.OP_VOUCHER_PRODUCTS_REVISE || operation === Operation.OP_VOUCHER_PRODUCTS_ENABLE || operation === Operation.OP_VOUCHER_PRODUCTS_DISABLE) return { productid: required(candidate, 'VOUCHER_TARGET_REQUIRED') };
  if (operation === Operation.OP_VOUCHER_CREDENTIALPOOLS_CLOSE || operation === Operation.OP_VOUCHER_CREDENTIALS_GENERATE || operation === Operation.OP_VOUCHER_CREDENTIALS_IMPORT) return { poolid: required(candidate, 'VOUCHER_TARGET_REQUIRED') };
  if (operation === Operation.OP_VOUCHER_STOCKREQUESTS_UPDATE || operation === Operation.OP_VOUCHER_STOCKREQUESTS_SUBMIT || operation === Operation.OP_VOUCHER_STOCKREQUESTS_CANCEL) return { requestid: required(candidate, 'VOUCHER_TARGET_REQUIRED') };
  if (operation === Operation.OP_VOUCHER_ISSUEORDERS_UPDATE || operation === Operation.OP_VOUCHER_ISSUEORDERS_SUBMIT || operation === Operation.OP_VOUCHER_ISSUEORDERS_CANCEL) return { orderid: required(candidate, 'VOUCHER_TARGET_REQUIRED') };
  if (operation === Operation.OP_VOUCHER_ISSUEBATCHES_RETRY) return { batchid: required(candidate, 'VOUCHER_TARGET_REQUIRED') };
  if (operation === Operation.OP_VOUCHER_ACTIONBATCHES_RETRY) return { actionbatchid: required(candidate, 'VOUCHER_TARGET_REQUIRED') };
  if (operation === Operation.OP_VOUCHER_VOUCHERS_BIND || operation === Operation.OP_VOUCHER_VOUCHERS_UNBIND) return { voucherid: required(candidate, 'VOUCHER_TARGET_REQUIRED') };
  if (operation === Operation.OP_VOUCHER_TENDERHOLDS_CONSUME || operation === Operation.OP_VOUCHER_TENDERHOLDS_RELEASE) return { holdid: required(candidate, 'VOUCHER_TARGET_REQUIRED') };
  if (operation === Operation.OP_VOUCHER_REFUNDS_CREATE) return { redemptionid: required(candidate, 'VOUCHER_TARGET_REQUIRED') };
  return undefined;
}

function product(value: Readonly<Record<string, string>>) { return { customer: required(value.customer), name: required(value.name), faceMinor: minor(value.face), currency: 'CNY', qualification: required(value.qualification), pool: optional(value.pool) ?? null, validity: { startsAt: instant(value.startsAt), expiresAt: instant(value.expiresAt) }, activation: one(value.activation, ['automatic', 'secret', 'numbersecret']), approvalRequired: value.approval === 'true' }; }
function stock(value: Readonly<Record<string, string>>) { return { customer: required(value.customer), product: required(value.product), pool: required(value.pool), quantity: positive(value.quantity), reason: required(value.reason) }; }
function issue(value: Readonly<Record<string, string>>) { return { customer: required(value.customer), product: required(value.product), stockRequest: required(value.stockRequest), quantity: positive(value.quantity), purpose: one(value.purpose, ['benefit', 'order', 'campaign', 'manual']), delivery: one(value.delivery, ['account', 'claim']), validity: { startsAt: instant(value.startsAt), expiresAt: instant(value.expiresAt) }, recipientSnapshot: required(value.recipient), reason: required(value.reason) }; }
function compact(value: Readonly<Record<string, string | undefined>>): Readonly<Record<string, string>> { return Object.freeze(Object.fromEntries(Object.entries(value).filter((entry): entry is [string, string] => Boolean(entry[1])))); }
function required(value: string | undefined, code = 'VOUCHER_FIELD_REQUIRED'): string { const result = optional(value); if (!result) throw new Error(code); return result; }
function optional(value: string | undefined): string | undefined { const result = value?.trim(); return result ? result : undefined; }
function natural(value: string | undefined): number | undefined { if (!optional(value)) return undefined; const result = Number(value); if (!Number.isSafeInteger(result) || result < 0) throw new Error('VOUCHER_VERSION_INVALID'); return result; }
function positive(value: string | undefined): number { const result = Number(value); if (!Number.isSafeInteger(result) || result < 1) throw new Error('VOUCHER_NUMBER_INVALID'); return result; }
function minor(value: string | undefined): number { const result = Math.round(Number(value) * 100); if (!Number.isSafeInteger(result) || result < 1) throw new Error('VOUCHER_AMOUNT_INVALID'); return result; }
function instant(value: string | undefined): string { const result = new Date(required(value)); if (!Number.isFinite(result.getTime())) throw new Error('VOUCHER_TIME_INVALID'); return result.toISOString(); }
function sha256(value: string | undefined): string { const result = required(value).toLowerCase(); if (!/^[0-9a-f]{64}$/.test(result)) throw new Error('VOUCHER_HASH_INVALID'); return result; }
function one<const T extends string>(value: string | undefined, values: readonly T[]): T { const result = values.find((candidate) => candidate === value); if (!result) throw new Error('VOUCHER_OPTION_INVALID'); return result; }
