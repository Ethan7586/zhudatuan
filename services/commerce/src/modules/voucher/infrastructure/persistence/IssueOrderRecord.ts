import { PgTransactionAccess } from '../../../../platform/database/PgTransactionAccess';
import { DomainError } from '../../../../platform/error/DomainError';
import type { ApprovalPort, ApprovalReadPort } from '../../../approval/public';
import type { ExportPort, JobPort } from '../../../runtime/public';
import type { IssueOrderRepository } from '../../application/port/IssueOrderRepository';
import { IssueBatch } from '../../domain/model/IssueBatch';
import { IssueOrder } from '../../domain/model/IssueOrder';
import { VoucherApproval } from '../../application/service/VoucherApproval';
import { STOCK_CAPACITY } from './StockCapacity';
import { freezeIssueTerms } from './IssueTerms';
import { createVoucherExport } from './PgVoucherExport';
import { BATCH, body, cursor, entity, expected, ISSUE, ISSUE_BATCH_FIELDS, ISSUE_ORDER_FIELDS, limit, number, one, optionalText, page, path, query, requiredIdempotency, text, write } from './VoucherSupport';

export interface IssueRow {
  readonly id: string;
  readonly scope_id: string;
  readonly customer_id: string;
  readonly product_id: string;
  readonly stock_request_id: string;
  readonly quantity: number;
  readonly purpose: 'benefit' | 'order' | 'campaign' | 'manual';
  readonly delivery: 'account' | 'claim';
  readonly starts_at: Date;
  readonly expires_at: Date;
  readonly recipient_snapshot: string;
  readonly reason: string;
  readonly requested_by: string;
  readonly approval_instance_id: string | null;
  readonly state: 'draft' | 'submitted' | 'approved' | 'issuing' | 'completed' | 'failed' | 'cancelled';
  readonly version: number;
}
export interface BatchRow {
  readonly id: string;
  readonly order_id: string;
  readonly state: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  readonly requested: number;
  readonly processed: number;
  readonly succeeded: number;
  readonly failed: number;
  readonly retryable: number;
  readonly version: number;
}
export function command(value: Readonly<Record<string, unknown>>) {
  const validity = value.validity && typeof value.validity === 'object' && !Array.isArray(value.validity) ? (value.validity as Readonly<Record<string, unknown>>) : {};
  const purpose = value.purpose;
  const delivery = value.delivery;
  if (!['benefit', 'order', 'campaign', 'manual'].includes(String(purpose)) || !['account', 'claim'].includes(String(delivery))) throw new DomainError('VALIDATION_FAILED');
  return {
    customer: text(value.customer, 'customer'),
    product: text(value.product, 'product'),
    stockRequest: text(value.stockRequest, 'stockRequest'),
    quantity: Number(value.quantity),
    purpose: purpose as IssueRow['purpose'],
    delivery: delivery as IssueRow['delivery'],
    startsAt: new Date(text(validity.startsAt, 'validity.startsAt')),
    expiresAt: new Date(text(validity.expiresAt, 'validity.expiresAt')),
    recipientSnapshot: text(value.recipientSnapshot, 'recipientSnapshot'),
    reason: text(value.reason, 'reason'),
  };
}
export function model(row: IssueRow) {
  return {
    id: row.id,
    scope: row.scope_id,
    customer: row.customer_id,
    product: row.product_id,
    stockRequest: row.stock_request_id,
    quantity: Number(row.quantity),
    purpose: row.purpose,
    delivery: row.delivery,
    startsAt: new Date(row.starts_at),
    expiresAt: new Date(row.expires_at),
    recipientSnapshot: row.recipient_snapshot,
    reason: row.reason,
    requester: row.requested_by,
    approval: row.approval_instance_id,
    state: row.state,
    version: Number(row.version),
  } as const;
}
export async function lock(database: ReturnType<PgTransactionAccess['database']>, id: string, scope: string): Promise<IssueRow> {
  const row = (await database.query<IssueRow>(`select ${ISSUE_ORDER_FIELDS} from voucher.issueorder issue where issue.id=$1 and issue.scope_id=$2 for update`, [id, scope])).rows[0];
  if (!row) throw new DomainError('RESOURCE_NOT_FOUND');
  return row;
}
export async function assertStock(database: ReturnType<PgTransactionAccess['database']>, scope: string, value: ReturnType<typeof command> | ReturnType<typeof model>, exclude: string | null = null) {
  // Serialize quota writers on the owner; the enclosing serializable transaction
  // rejects a stale snapshot instead of allowing concurrent reservations to exceed it.
  await database.query(`select id from voucher.stockrequest where id=$1 and scope_id=$2 for update`, [value.stockRequest, scope]);
  const row = await database.query<{ approved: number }>(
    `${STOCK_CAPACITY}
    where request.scope_id=$1 and request.id=$3 and request.customer_id=$4 and request.product_id=$5 and request.state='approved'`,
    [scope, exclude, value.stockRequest, value.customer, value.product]
  );
  if (!row.rows[0]) throw new DomainError('VOUCHER_APPROVAL_REQUIRED');
  if (value.quantity > row.rows[0].approved) throw new DomainError('VOUCHER_STOCK_INSUFFICIENT');
}
export function snapshotOf(row: IssueRow) {
  return {
    customer: row.customer_id,
    product: row.product_id,
    stockRequest: row.stock_request_id,
    quantity: Number(row.quantity),
    purpose: row.purpose,
    delivery: row.delivery,
    startsAt: row.starts_at.toISOString(),
    expiresAt: row.expires_at.toISOString(),
    recipientSnapshot: row.recipient_snapshot,
    reason: row.reason,
  };
}
