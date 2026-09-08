import { createHash, randomUUID } from 'node:crypto';
import { PgTransactionAccess } from '../../../../platform/database/PgTransactionAccess';
import { DomainError } from '../../../../platform/error/DomainError';
import type { AdjustmentRepository } from '../../application/port/AdjustmentRepository';

export class PgAdjustmentRepository implements AdjustmentRepository {
  constructor(private readonly transactions = new PgTransactionAccess()) {}

  async create(context: Parameters<AdjustmentRepository['create']>[0], input: Parameters<AdjustmentRepository['create']>[1]) {
    const database = this.transactions.database(context);
    const stock = await database.query<{ id: string; sku: string; location: string; onhand: number; safety: number; version: number }>(
      `select id,sku_id sku,location_id location,onhand::float8 onhand,safety::float8 safety,version::float8 version
      from inventory.stockitem where id=$1 and (scope_id=$2 or location_id=$2) for update`,
      [input.stockitem, input.scope]
    );
    const selected = stock.rows[0];
    if (!selected) throw new DomainError('RESOURCE_NOT_FOUND');
    if (selected.version !== input.expectedVersion) throw new DomainError('VERSION_CONFLICT');
    const pending = await database.query(`select id from inventory.adjustmentrequest where scope_id=$1 and stockitem_id=$2 and state='pending' limit 1`, [input.scope, selected.id]);
    if (pending.rows[0]) throw new DomainError('VERSION_CONFLICT');
    const id = `inventoryadjustment:${randomUUID()}`;
    const snapshot = Object.freeze({
      stockitem: selected.id,
      sku: selected.sku,
      location: selected.location,
      onhand: selected.onhand,
      safety: selected.safety,
      quantityDelta: input.quantityDelta,
      reason: input.reason,
      stockVersion: selected.version,
    });
    const evidenceHash = createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');
    const approval = await input.approvals.request(context, {
      scopeId: input.scope,
      requesterId: input.requester,
      subject: { kind: 'inventoryadjustment', id, version: 0, snapshot },
      action: 'inventory.adjustment.apply',
      evidenceHash,
      constraints: { stockitem: selected.id, expectedVersion: selected.version, idempotency: input.idempotency },
      expiresAt: null,
    });
    const result = await database.query(
      `insert into inventory.adjustmentrequest(id,tenant_id,scope_id,stockitem_id,sku_id,location_id,quantity_delta,reason,state,
      approval_instance_id,requested_by,created_at,updated_at,version) values($1,$2,$3,$4,$5,$6,$7,$8,'pending',$9,$10,clock_timestamp(),clock_timestamp(),0)
      returning id,scope_id scope,stockitem_id stockitem,sku_id sku,location_id location,quantity_delta::float8 "quantityDelta",
      reason,state,approval_instance_id "approvalId",requested_by "requestedBy",created_at "createdAt",updated_at "updatedAt",version::float8 version`,
      [id, context.tenant, input.scope, selected.id, selected.sku, selected.location, input.quantityDelta, input.reason, approval.instanceId, input.requester]
    );
    return Object.freeze(result.rows[0]!);
  }

  async read(context: Parameters<AdjustmentRepository['read']>[0], scope: string, page: Parameters<AdjustmentRepository['read']>[2]) {
    const result = await this.transactions.database(context).query(
      `select id,scope_id scope,stockitem_id stockitem,sku_id sku,location_id location,quantity_delta::float8 "quantityDelta",
      reason,state,approval_instance_id "approvalId",requested_by "requestedBy",created_at "createdAt",updated_at "updatedAt",version::float8 version
      from inventory.adjustmentrequest where scope_id=$1 and ($2::timestamptz is null or (created_at,id)<($2::timestamptz,$3))
      order by created_at desc,id desc limit $4`,
      [scope, page.sort, page.id, page.fetch]
    );
    return Object.freeze(result.rows.map((row) => Object.freeze(row)));
  }
}
