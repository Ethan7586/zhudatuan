import { randomUUID } from 'node:crypto';
import type { OperationId, OperationOutputFor } from '@shop/contract';
import type { OperationReply } from '../../../../pipeline/OperationHandler';
import { DomainError } from '../../../../platform/error/DomainError';
import { requireWriteTransaction, type WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import type { VoucherCall } from '../../application/port/VoucherCall';

export type RecordValue = Readonly<Record<string, unknown>>;

export function body<TKey extends OperationId>(call: VoucherCall<TKey>): RecordValue {
  return record((call.input as { readonly body?: unknown }).body);
}

export function path<TKey extends OperationId>(call: VoucherCall<TKey>, field: string): string {
  return text(record((call.input as { readonly path?: unknown }).path)[field], field);
}

export function query<TKey extends OperationId>(call: VoucherCall<TKey>): RecordValue {
  return record((call.input as { readonly query?: unknown }).query);
}

export function text(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() === '') throw new DomainError('VALIDATION_FAILED', { field });
  return value;
}

export function optionalText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

export function integer(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || Number(value) <= 0) throw new DomainError('VALIDATION_FAILED', { field });
  return Number(value);
}

export function expected<TKey extends OperationId>(call: VoucherCall<TKey>): number {
  if (!call.expectedVersion || !Number.isSafeInteger(call.expectedVersion)) throw new DomainError('EXPECTED_VERSION_REQUIRED');
  return call.expectedVersion;
}

export function requiredIdempotency<TKey extends OperationId>(call: VoucherCall<TKey>): string {
  if (!call.idempotency) throw new DomainError('IDEMPOTENCY_KEY_REQUIRED');
  return call.idempotency;
}

export function write<TKey extends OperationId>(call: VoucherCall<TKey>): WriteTransactionContext {
  return requireWriteTransaction(call.context.transaction);
}

export function entity(prefix: string): string {
  return `${prefix}:${randomUUID()}`;
}
export function number(prefix: string): string {
  return `${prefix}${Date.now().toString(36).toUpperCase()}${randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase()}`;
}

export function limit(value: unknown, maximum = 100): number {
  const parsed = typeof value === 'string' ? Number.parseInt(value, 10) : value;
  return Number.isInteger(parsed) ? Math.min(Math.max(Number(parsed), 1), maximum) : 20;
}

export function cursor(value: unknown): string | null {
  return optionalText(value);
}

export function one<TKey extends OperationId>(status: number, row: unknown): OperationReply<OperationOutputFor<TKey>> {
  if (row === undefined || row === null) throw new DomainError('RESOURCE_NOT_FOUND');
  return { status, body: normalize(row) as OperationOutputFor<TKey> };
}

export function page<TKey extends OperationId>(rows: readonly unknown[], fetch: number, cursorField = 'id'): OperationReply<OperationOutputFor<TKey>> {
  const hasMore = rows.length > fetch;
  const items = rows.slice(0, fetch).map((item) => normalize(item));
  const last = items.at(-1);
  const nextCursor = hasMore && last && typeof last === 'object' && cursorField in last ? String((last as RecordValue)[cursorField]) : undefined;
  return { status: 200, body: { items, count: items.length, ...(nextCursor ? { nextCursor } : {}) } as OperationOutputFor<TKey> };
}

export function normalize(value: unknown, field?: string): unknown {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string' && field !== undefined && ['startsAt', 'expiresAt', 'redeemedAt'].includes(field) && /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value))) return new Date(value).toISOString();
  if (typeof value === 'bigint') return Number(value);
  if (Array.isArray(value)) return value.map((item) => normalize(item));
  if (value && typeof value === 'object') return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalize(item, key)])));
  return value;
}

function record(value: unknown): RecordValue {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return Object.freeze({});
  return value as RecordValue;
}

export function databaseCode(cause: unknown): string | undefined {
  return cause !== null && typeof cause === 'object' && 'code' in cause && typeof cause.code === 'string' ? cause.code : undefined;
}

export const VOUCHER_FIELDS = `voucher.id,voucher.scope_id,voucher.credential_id,voucher.product_id,voucher.holder_id,
  voucher.initial_minor,voucher.remaining_minor,voucher.currency,voucher.state,voucher.starts_at,voucher.expires_at,voucher.version`;
export const HOLD_FIELDS = `hold.id,hold.scope_id,hold.voucher_id,hold.owner_id,hold.amount_minor,hold.state,
  hold.expires_at,hold.idempotency_key,hold.version`;
export const PRODUCT_FIELDS = `product.id,product.scope_id,product.customer_id,product.name,product.face_minor,product.currency,
  product.qualification_id,product.pool_id,product.starts_at,product.expires_at,product.activation,product.approval_required,product.state,product.version`;
export const STOCK_REQUEST_FIELDS = `request.id,request.scope_id,request.customer_id,request.product_id,request.pool_id,
  request.quantity,request.reason,request.requested_by,request.approval_instance_id,request.state,request.version`;
export const ISSUE_ORDER_FIELDS = `issue.id,issue.scope_id,issue.customer_id,issue.product_id,issue.stock_request_id,
  issue.quantity,issue.purpose,issue.delivery,issue.starts_at,issue.expires_at,issue.recipient_snapshot,issue.reason,
  issue.requested_by,issue.approval_instance_id,issue.state,issue.version`;
export const ISSUE_BATCH_FIELDS = `batch.id,batch.order_id,batch.state,batch.requested,batch.processed,batch.succeeded,
  batch.failed,batch.retryable,batch.version`;
export const ACTION_BATCH_FIELDS = `batch.id,batch.snapshot_id,batch.action,batch.state,batch.requested,batch.processed,
  batch.succeeded,batch.failed,batch.retryable,batch.version`;

export const PRODUCT = `select product.id,product.number,product.scope_id as "scopeId",product.customer_id as customer,product.name,
  product.face_minor::integer as "faceMinor",product.currency,product.qualification_id as qualification,product.pool_id as pool,
  jsonb_build_object('startsAt',product.starts_at,'expiresAt',product.expires_at) validity,product.activation,product.approval_required as "approvalRequired",
  product.state,product.version::integer,product.created_at as "createdAt",product.updated_at as "updatedAt" from voucher.product product`;
export const POOL = `select pool.id,pool.number,pool.scope_id as "scopeId",pool.product_id as product,pool.name,pool.mode,pool.prefix,
  pool.capacity::integer,pool.generated::integer,coalesce(count(credential.id) filter(where credential.state='available'),0)::integer available,
  coalesce(count(credential.id) filter(where credential.state='allocated'),0)::integer allocated,pool.state,pool.version::integer,
  pool.created_at as "createdAt",pool.updated_at as "updatedAt" from voucher.credentialpool pool left join voucher.credential credential on credential.pool_id=pool.id`;
export const CREDENTIAL = `select credential.id,credential.pool_id as pool,credential.product_id as product,credential.number_masked as "numberMasked",
  credential.number_fingerprint as fingerprint,credential.key_version as "keyVersion",credential.state,credential.issue_batch_id as "issueBatch",
  credential.version::integer,credential.created_at as "createdAt" from voucher.credential credential`;
export const STOCK = `select request.id,request.number,request.scope_id as "scopeId",request.customer_id as customer,request.product_id as product,
  request.pool_id as pool,request.quantity::integer,request.reason,request.state,request.approval_instance_id as approval,
  request.requested_by as "requestedBy",request.version::integer,request.created_at as "createdAt",request.updated_at as "updatedAt" from voucher.stockrequest request`;
export const ISSUE = `select issue.id,issue.number,issue.scope_id as "scopeId",issue.customer_id as customer,issue.product_id as product,
  issue.stock_request_id as "stockRequest",issue.quantity::integer,issue.purpose,issue.delivery,
  jsonb_build_object('startsAt',issue.starts_at,'expiresAt',issue.expires_at) validity,issue.recipient_snapshot as "recipientSnapshot",issue.reason,issue.state,
  issue.approval_instance_id as approval,batch.id as "issueBatch",coalesce(batch.succeeded,0)::integer issued,coalesce(batch.failed,0)::integer failed,
  issue.requested_by as "requestedBy",issue.version::integer,issue.created_at as "createdAt",issue.updated_at as "updatedAt"
  from voucher.issueorder issue left join voucher.issuebatch batch on batch.order_id=issue.id`;
export const BATCH = `select batch.id,batch.order_id as "order",batch.scope_id as "scopeId",batch.state,batch.requested::integer,
  batch.processed::integer,batch.succeeded::integer,batch.failed::integer,batch.retryable::integer,batch.version::integer,
  batch.created_at as "createdAt",batch.updated_at as "updatedAt" from voucher.issuebatch batch`;
export const VOUCHER = `select voucher.id,voucher.number_masked as "numberMasked",voucher.scope_id as "scopeId",voucher.product_id as product,product.name as "productName",
  voucher.credential_id as credential,holder.member_id as holder,voucher.initial_minor::integer as "initialMinor",voucher.remaining_minor::integer as "remainingMinor",
  voucher.currency,voucher.state,jsonb_build_object('startsAt',voucher.starts_at,'expiresAt',voucher.expires_at) validity,
  voucher.version::integer,voucher.created_at as "createdAt",voucher.updated_at as "updatedAt"
  from voucher.voucher voucher join voucher.product product on product.id=voucher.product_id left join voucher.holder holder on holder.id=voucher.holder_id and holder.state='bound'`;
export const HOLD = `select hold.id,hold.voucher_id as voucher,hold.owner_id as owner,hold.amount_minor::integer as "amountMinor",hold.state,
  hold.expires_at as "expiresAt",hold.idempotency_key as idempotency,hold.version::integer,hold.created_at as "createdAt",hold.updated_at as "updatedAt" from voucher.tenderhold hold`;
export const REDEMPTION = `select redemption.id,redemption.voucher_id as voucher,redemption.hold_id as hold,redemption.verification_id as verification,
  redemption.order_id as "order",redemption.amount_minor::integer as "amountMinor",redemption.refunded_minor::integer as "refundedMinor",redemption.currency,
  redemption.state,redemption.version::integer,redemption.redeemed_at as "redeemedAt",redemption.updated_at as "updatedAt" from voucher.redemption redemption`;
export const ACTION = `select batch.id,batch.scope_id as "scopeId",batch.snapshot_id as snapshot,batch.action,batch.reason,batch.expires_at as "expiresAt",
  batch.state,batch.requested::integer,batch.processed::integer,batch.succeeded::integer,batch.failed::integer,batch.retryable::integer,
  batch.version::integer,batch.created_at as "createdAt",batch.updated_at as "updatedAt" from voucher.actionbatch batch`;
