import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import { DomainError } from '../../../../foundation/domain/DomainError';
import type { ApprovalPort, ApprovalReadPort } from '../../../approval/public';
import type { StockRequestRepository } from '../../application/port/StockRequestRepository';
import { StockRequest } from '../../domain/model/StockRequest';
import { VoucherApproval } from '../../application/service/VoucherApproval';
import { STOCK_CAPACITY } from './StockCapacity';
import { POOL_CAPACITY } from './PoolCapacity';
import { body, cursor, entity, expected, limit, number, one, optionalText, page, path, query, STOCK, STOCK_REQUEST_FIELDS, text, write } from './VoucherSupport';

export class PgStockRequestRepository implements StockRequestRepository {
  private readonly approvals: VoucherApproval;
  constructor(approval: ApprovalPort, approvalRead: ApprovalReadPort, private readonly transactions = new PgTransactionAccess()) {
    this.approvals = new VoucherApproval(approval, approvalRead);
  }
  async create(call: Parameters<StockRequestRepository['create']>[0]) {
    const database = this.transactions.database(call.context.transaction); const value = command(body(call));
    await assertReferences(database, call.scope, value.customer, value.product, value.pool);
    const request = new StockRequest({ id: entity('stockrequest'), scope: call.scope, ...value, requester: call.actor, approval: null, state: 'draft', version: 1 });
    await database.query(`insert into voucher.stockrequest(id,number,scope_id,customer_id,product_id,pool_id,quantity,reason,state,approval_instance_id,requested_by,version,created_at,updated_at)
      values($1,$2,$3,$4,$5,$6,$7,$8,'draft',null,$9,1,$10,$10)`, [request.value.id, number('SR'), call.scope, value.customer, value.product, value.pool, value.quantity, value.reason, call.actor, call.now]);
    return this.read(call, request.value.id, 201, 'voucher.stockrequests.create');
  }
  async update(call: Parameters<StockRequestRepository['update']>[0]) {
    const database = this.transactions.database(call.context.transaction); const id = path(call, 'requestid'); const value = command(body(call));
    const row = await lock(database, id, call.scope); if (row.version !== expected(call)) throw new DomainError('VERSION_CONFLICT');
    await assertReferences(database, call.scope, value.customer, value.product, value.pool);
    const revised = new StockRequest(model(row)).revise(value);
    await database.query(`update voucher.stockrequest set customer_id=$3,product_id=$4,pool_id=$5,quantity=$6,reason=$7,version=$8 where id=$1 and scope_id=$2`, [id, call.scope, value.customer, value.product, value.pool, value.quantity, value.reason, revised.value.version]);
    return this.read(call, id, 200, 'voucher.stockrequests.update');
  }
  async submit(call: Parameters<StockRequestRepository['submit']>[0]) {
    const database = this.transactions.database(call.context.transaction); const id = path(call, 'requestid'); const row = await lock(database, id, call.scope);
    if (row.version !== expected(call)) throw new DomainError('VERSION_CONFLICT');
    const aggregate = new StockRequest(model(row));
    aggregate.assertSubmittable();
    // All new commitments serialize on the pool. The enclosing serializable
    // transaction also detects a stale predicate snapshot after a competing submit.
    const pool = await database.query<{ state: string }>(`select state from voucher.credentialpool where id=$1 and scope_id=$2 for update`, [row.pool_id, call.scope]);
    if (!pool.rows[0]) throw new DomainError('RESOURCE_NOT_FOUND');
    if (pool.rows[0].state !== 'open') throw new DomainError('VOUCHER_POOL_CLOSED');
    await assertReferences(database, call.scope, row.customer_id, row.product_id, row.pool_id);
    const capacity = await database.query<{ available: number }>(`${POOL_CAPACITY} where pool.id=$1 and pool.scope_id=$2`, [row.pool_id, call.scope]);
    if ((capacity.rows[0]?.available ?? 0) < row.quantity) throw new DomainError('VOUCHER_STOCK_INSUFFICIENT');
    const snapshot = snapshotOf(row); const receipt = await this.approvals.request(write(call), {
      subject: { kind: 'voucherstock', id, version: row.version, snapshot }, action: 'voucher.stock.allocate',
      constraints: { pool: row.pool_id, product: row.product_id, quantity: Number(row.quantity) }, expiresAt: null });
    const submitted = aggregate.submit(receipt.instanceId);
    await database.query(`update voucher.stockrequest set approval_instance_id=$3,state='submitted',version=$4 where id=$1 and scope_id=$2`, [id, call.scope, receipt.instanceId, submitted.value.version]);
    return this.read(call, id, 200, 'voucher.stockrequests.submit');
  }
  async cancel(call: Parameters<StockRequestRepository['cancel']>[0]) {
    const database = this.transactions.database(call.context.transaction); const id = path(call, 'requestid'); const row = await lock(database, id, call.scope);
    if (row.version !== expected(call)) throw new DomainError('VERSION_CONFLICT');
    const cancelled = new StockRequest(model(row)).cancel();
    if (row.approval_instance_id) {
      await this.approvals.cancel(write(call), {
        scope: call.scope, instance: row.approval_instance_id, reason: text(body(call).reason, 'reason') });
    }
    await database.query(`update voucher.stockrequest set state='cancelled',version=$3 where id=$1 and scope_id=$2`, [id, call.scope, cancelled.value.version]);
    return this.read(call, id, 200, 'voucher.stockrequests.cancel');
  }
  async get(call: Parameters<StockRequestRepository['get']>[0]) { return this.read(call, path(call, 'requestid'), 200, 'voucher.stockrequests.get'); }
  async list(call: Parameters<StockRequestRepository['list']>[0]) {
    const database = this.transactions.database(call.context.transaction); const filter = query(call); const fetch = limit(filter.limit);
    const rows = await database.query(`${STOCK} where request.scope_id=$1 and ($2::text is null or request.state=$2) and ($3::text is null or request.customer_id=$3)
      and ($4::text is null or request.id>$4) order by request.id limit $5`, [call.scope, optionalText(filter.state), optionalText(filter.customer), cursor(filter.cursor), fetch + 1]);
    return page<'voucher.stockrequests.list'>(rows.rows, fetch);
  }
  async options(call: Parameters<StockRequestRepository['options']>[0]) {
    const database = this.transactions.database(call.context.transaction); const filter = query(call); const fetch = limit(filter.limit);
    const rows = await database.query(`${STOCK_CAPACITY} where request.scope_id=$1 and request.state='approved'
      and ($3::text is null or request.id>$3) order by request.id limit $4`, [call.scope, null, cursor(filter.cursor), fetch + 1]);
    return page<'voucher.stockrequestoptions.list'>(rows.rows, fetch, 'request');
  }
  private async read(call: Parameters<StockRequestRepository[keyof StockRequestRepository]>[0], id: string, status: number, operation: 'voucher.stockrequests.create' | 'voucher.stockrequests.update' | 'voucher.stockrequests.submit' | 'voucher.stockrequests.cancel' | 'voucher.stockrequests.get') {
    const row = await this.transactions.database(call.context.transaction).query(`${STOCK} where request.id=$1 and request.scope_id=$2`, [id, call.scope]);
    return one<typeof operation>(status, row.rows[0]);
  }
}
interface StockRow { readonly id: string; readonly scope_id: string; readonly customer_id: string; readonly product_id: string; readonly pool_id: string; readonly quantity: number; readonly reason: string; readonly requested_by: string; readonly approval_instance_id: string | null; readonly state: 'draft' | 'submitted' | 'approved' | 'rejected' | 'cancelled' | 'fulfilled'; readonly version: number; }
function command(value: Readonly<Record<string, unknown>>) { return { customer: text(value.customer, 'customer'), product: text(value.product, 'product'), pool: text(value.pool, 'pool'), quantity: Number(value.quantity), reason: text(value.reason, 'reason') }; }
function model(row: StockRow) { return { id: row.id, scope: row.scope_id, customer: row.customer_id, product: row.product_id, pool: row.pool_id, quantity: Number(row.quantity), reason: row.reason, requester: row.requested_by, approval: row.approval_instance_id, state: row.state, version: Number(row.version) } as const; }
async function lock(database: ReturnType<PgTransactionAccess['database']>, id: string, scope: string): Promise<StockRow> { const row = (await database.query<StockRow>(`select ${STOCK_REQUEST_FIELDS} from voucher.stockrequest request where request.id=$1 and request.scope_id=$2 for update`, [id, scope])).rows[0]; if (!row) throw new DomainError('RESOURCE_NOT_FOUND'); return row; }
async function assertReferences(database: ReturnType<PgTransactionAccess['database']>, scope: string, customer: string, product: string, pool: string) { const row = await database.query(`select 1 from voucher.product product join voucher.credentialpool pool on pool.id=$4 and pool.product_id=product.id and pool.scope_id=product.scope_id where product.id=$3 and product.scope_id=$1 and product.customer_id=$2 and product.state='enabled' and product.pool_id=pool.id and pool.state='open'`, [scope, customer, product, pool]); if (!row.rows[0]) throw new DomainError('VOUCHER_PRODUCT_INCOMPLETE'); }
function snapshotOf(row: StockRow) { return { customer: row.customer_id, product: row.product_id, pool: row.pool_id, quantity: Number(row.quantity), reason: row.reason }; }
