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

import { assertStock, command, lock, model, snapshotOf, type BatchRow, type IssueRow } from './IssueOrderRecord';
export class PgIssueOrderRepository implements IssueOrderRepository {
  private readonly approvals: VoucherApproval;
  constructor(
    approval: ApprovalPort,
    approvalRead: ApprovalReadPort,
    private readonly jobs: JobPort,
    private readonly exports: ExportPort,
    private readonly transactions = new PgTransactionAccess()
  ) {
    this.approvals = new VoucherApproval(approval, approvalRead);
  }
  async create(call: Parameters<IssueOrderRepository['create']>[0]) {
    const database = this.transactions.database(call.context.transaction);
    const value = command(body(call));
    await assertStock(database, call.scope, value);
    const issue = new IssueOrder({ id: entity('issueorder'), scope: call.scope, ...value, requester: call.actor, approval: null, state: 'draft', version: 1 });
    await database.query(
      `insert into voucher.issueorder(id,number,scope_id,customer_id,product_id,stock_request_id,quantity,purpose,delivery,starts_at,expires_at,recipient_snapshot,reason,state,approval_instance_id,requested_by,version,created_at,updated_at)
      values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'draft',null,$14,1,$15,$15)`,
      [issue.value.id, number('IO'), call.scope, value.customer, value.product, value.stockRequest, value.quantity, value.purpose, value.delivery, value.startsAt, value.expiresAt, value.recipientSnapshot, value.reason, call.actor, call.now]
    );
    return this.read(call, issue.value.id, 201, 'voucher.issueorders.create');
  }
  async update(call: Parameters<IssueOrderRepository['update']>[0]) {
    const database = this.transactions.database(call.context.transaction);
    const id = path(call, 'orderid');
    const value = command(body(call));
    const row = await lock(database, id, call.scope);
    if (row.version !== expected(call)) throw new DomainError('VERSION_CONFLICT');
    await assertStock(database, call.scope, value, id);
    const revised = new IssueOrder(model(row)).revise(value);
    await database.query(
      `update voucher.issueorder set customer_id=$3,product_id=$4,stock_request_id=$5,quantity=$6,purpose=$7,delivery=$8,starts_at=$9,expires_at=$10,
      recipient_snapshot=$11,reason=$12,version=$13 where id=$1 and scope_id=$2`,
      [id, call.scope, value.customer, value.product, value.stockRequest, value.quantity, value.purpose, value.delivery, value.startsAt, value.expiresAt, value.recipientSnapshot, value.reason, revised.value.version]
    );
    return this.read(call, id, 200, 'voucher.issueorders.update');
  }
  async submit(call: Parameters<IssueOrderRepository['submit']>[0]) {
    const database = this.transactions.database(call.context.transaction);
    const id = path(call, 'orderid');
    const row = await lock(database, id, call.scope);
    if (row.version !== expected(call)) throw new DomainError('VERSION_CONFLICT');
    await assertStock(database, call.scope, model(row), id);
    if (row.state !== 'draft') throw new DomainError('VOUCHER_APPROVAL_REQUIRED');
    const terms = await freezeIssueTerms(database, {
      order: id,
      scope: call.scope,
      product: row.product_id,
      customer: row.customer_id,
      stockRequest: row.stock_request_id,
      quantity: Number(row.quantity),
      startsAt: new Date(row.starts_at),
      expiresAt: new Date(row.expires_at),
      now: call.now,
    });
    const snapshot = { ...snapshotOf(row), terms: terms.value };
    const receipt = await this.approvals.request(write(call), {
      subject: { kind: 'voucherissue', id, version: row.version, snapshot },
      action: 'voucher.issue',
      amountMinor: terms.amount(Number(row.quantity)),
      currency: terms.value.currency,
      constraints: { stockRequest: row.stock_request_id, product: row.product_id, productVersion: terms.value.productVersion, quantity: Number(row.quantity) },
      expiresAt: null,
    });
    const submitted = new IssueOrder(model(row)).submit(receipt.instanceId);
    await database.query(`update voucher.issueorder set approval_instance_id=$3,state='submitted',version=$4 where id=$1 and scope_id=$2`, [id, call.scope, receipt.instanceId, submitted.value.version]);
    return this.read(call, id, 200, 'voucher.issueorders.submit');
  }
  async cancel(call: Parameters<IssueOrderRepository['cancel']>[0]) {
    const database = this.transactions.database(call.context.transaction);
    const id = path(call, 'orderid');
    const row = await lock(database, id, call.scope);
    if (row.version !== expected(call)) throw new DomainError('VERSION_CONFLICT');
    const cancelled = new IssueOrder(model(row)).cancel();
    if (row.approval_instance_id)
      await this.approvals.cancel(write(call), {
        scope: call.scope,
        instance: row.approval_instance_id,
        reason: text(body(call).reason, 'reason'),
      });
    await database.query(`update voucher.issueorder set state='cancelled',version=$3 where id=$1 and scope_id=$2`, [id, call.scope, cancelled.value.version]);
    return this.read(call, id, 200, 'voucher.issueorders.cancel');
  }
  async get(call: Parameters<IssueOrderRepository['get']>[0]) {
    return this.read(call, path(call, 'orderid'), 200, 'voucher.issueorders.get');
  }
  async list(call: Parameters<IssueOrderRepository['list']>[0]) {
    const database = this.transactions.database(call.context.transaction);
    const filter = query(call);
    const fetch = limit(filter.limit);
    const rows = await database.query(
      `${ISSUE} where issue.scope_id=$1 and ($2::text is null or issue.state=$2) and ($3::text is null or issue.customer_id=$3)
      and ($4::text is null or issue.id>$4) order by issue.id limit $5`,
      [call.scope, optionalText(filter.state), optionalText(filter.customer), cursor(filter.cursor), fetch + 1]
    );
    return page<'voucher.issueorders.list'>(rows.rows, fetch);
  }
  async retry(call: Parameters<IssueOrderRepository['retry']>[0]) {
    const database = this.transactions.database(call.context.transaction);
    const id = path(call, 'batchid');
    const selected = await database.query<BatchRow>(`select ${ISSUE_BATCH_FIELDS} from voucher.issuebatch batch where batch.id=$1 and batch.scope_id=$2 for update`, [id, call.scope]);
    const row = selected.rows[0];
    if (!row) throw new DomainError('RESOURCE_NOT_FOUND');
    if (row.version !== expected(call)) throw new DomainError('VERSION_CONFLICT');
    const retry = new IssueBatch({
      id: row.id,
      order: row.order_id,
      state: row.state,
      requested: row.requested,
      processed: row.processed,
      succeeded: row.succeeded,
      failed: row.failed,
      retryable: row.retryable,
      version: row.version,
    }).retry();
    await database.query(`update voucher.issuebatch set state='queued',processed=$3,failed=$4,retryable=0,version=$5 where id=$1 and scope_id=$2`, [id, call.scope, retry.value.processed, retry.value.failed, retry.value.version]);
    await database.query(`update voucher.issueitem set state='queued',error_code=null,retryable=false,updated_at=clock_timestamp() where batch_id=$1 and retryable`, [id]);
    await this.jobs.create(write(call), { scope: call.scope, owner: 'voucher', kind: 'voucherissue', queue: 'batch', payload: { batch: id }, idempotency: requiredIdempotency(call), actor: call.actor });
    return one<'voucher.issuebatches.retry'>(202, (await database.query(`${BATCH} where batch.id=$1 and batch.scope_id=$2`, [id, call.scope])).rows[0]);
  }
  async batch(call: Parameters<IssueOrderRepository['batch']>[0]) {
    const row = await this.transactions.database(call.context.transaction).query(`${BATCH} where batch.id=$1 and batch.scope_id=$2`, [path(call, 'batchid'), call.scope]);
    return one<'voucher.issuebatches.get'>(200, row.rows[0]);
  }
  async export(call: Parameters<IssueOrderRepository['export']>[0]) {
    const database = this.transactions.database(call.context.transaction);
    const order = text(body(call).order, 'order');
    if (!(await database.query(`select id from voucher.issueorder where id=$1 and scope_id=$2`, [order, call.scope])).rows[0]) throw new DomainError('RESOURCE_NOT_FOUND');
    const result = await createVoucherExport(call, { kind: 'issueorder', snapshot: { order } }, { database, exports: this.exports, jobs: this.jobs });
    return { status: 202, body: result };
  }
  private async read(
    call: Parameters<IssueOrderRepository[keyof IssueOrderRepository]>[0],
    id: string,
    status: number,
    operation: 'voucher.issueorders.create' | 'voucher.issueorders.update' | 'voucher.issueorders.submit' | 'voucher.issueorders.cancel' | 'voucher.issueorders.get'
  ) {
    const row = await this.transactions.database(call.context.transaction).query(`${ISSUE} where issue.id=$1 and issue.scope_id=$2`, [id, call.scope]);
    return one<typeof operation>(status, row.rows[0]);
  }
}
