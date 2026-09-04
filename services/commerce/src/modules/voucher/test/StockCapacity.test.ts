import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it, vi } from 'vitest';
import type { OperationId } from '@shop/contract';
import { withReadTransaction, withWriteTransaction, result } from '../../../test/TransactionFixture';
import type { ReadTransactionContext } from '../../../foundation/persistence/TransactionContext';
import type { VoucherCall } from '../application/port/VoucherCall';
import { PgStockRequestRepository } from '../infrastructure/persistence/PgStockRequestRepository';
import { PgIssueOrderRepository } from '../infrastructure/persistence/PgIssueOrderRepository';

describe('stock allocation SQL', () => {
  it('does not multiply counts, retains failed reservations and paginates by request', async () => {
    const database = await fixture();
    try {
      const repository = new PgStockRequestRepository({} as never, {} as never);
      const query = executor(database);
      const first = await withReadTransaction(query, context => repository.options(call(context, { query: { limit: 1 } })));
      expect(first.body).toEqual({ items: [{ request: 'stock:one', number: 'SR1', product: 'product:one', pool: 'pool:one', customer: 'customer:one', available: 3, approved: 3 }], count: 1, nextCursor: 'stock:one' });
      const next = await withReadTransaction(query, context => repository.options(call(context, { query: { limit: 1, cursor: 'stock:one' } })));
      expect(next.body).toEqual({ items: [{ request: 'stock:two', number: 'SR2', product: 'product:one', pool: 'pool:empty', customer: 'customer:one', available: 0, approved: 2 }], count: 1 });
    } finally { await database.close(); }
  });

  it('locks the quota before checking and refuses a request above the remaining allocation', async () => {
    const database = await fixture();
    try {
      const query = executor(database);
      const repository = new PgIssueOrderRepository({} as never, {} as never, {} as never, {} as never);
      await expect(withWriteTransaction(query, context => repository.create(call(context, { body: command(4) })))).rejects.toThrow('VOUCHER_STOCK_INSUFFICIENT');
      expect(query.mock.calls[0]).toEqual(['select id from voucher.stockrequest where id=$1 and scope_id=$2 for update', ['stock:one', 'mall:one']]);
      expect(query.mock.calls.some(([sql]) => sql.startsWith('insert'))).toBe(false);
    } finally { await database.close(); }
  });

  it('excludes only the revised order and continues reserving other failed orders', async () => {
    const database = await fixture();
    try {
      const query = executor(database);
      const repository = new PgIssueOrderRepository({} as never, {} as never, {} as never, {} as never);
      const revised = await withWriteTransaction(query, context => repository.update({ ...call<'voucher.issueorders.update'>(context,
        { path: { orderid: 'issue:draft' }, body: command(5) }), expectedVersion: 1 }));
      expect(revised.body.quantity).toBe(5);
      await expect(withWriteTransaction(query, context => repository.create(call(context, { body: command(1) })))).rejects.toThrow('VOUCHER_STOCK_INSUFFICIENT');
    } finally { await database.close(); }
  });
});

function command(quantity: number) {
  return { customer: 'customer:one', product: 'product:one', stockRequest: 'stock:one', quantity, purpose: 'manual', delivery: 'claim',
    validity: { startsAt: '2026-09-05T00:00:00.000Z', expiresAt: '2026-12-05T00:00:00.000Z' }, recipientSnapshot: 'snapshot:one', reason: '员工福利' };
}
function call<TKey extends OperationId>(transaction: ReadTransactionContext, input: unknown): VoucherCall<TKey> {
  return { input, context: { transaction }, scope: 'mall:one', actor: 'actor:one', now: new Date('2026-09-05T00:00:00.000Z') } as VoucherCall<TKey>;
}
function executor(database: PGlite) {
  return vi.fn(async (sql: string, values?: readonly unknown[]) => result((await database.query<Record<string, unknown>>(sql, values ? [...values] : [])).rows));
}
async function fixture(): Promise<PGlite> {
  const database = new PGlite();
  await database.exec(`create schema voucher;
    create table voucher.stockrequest(id text primary key,number text,scope_id text,product_id text,pool_id text,customer_id text,quantity integer,state text);
    create table voucher.credential(id text primary key,scope_id text,pool_id text,product_id text,state text);
    create table voucher.issueorder(id text primary key,number text,scope_id text,stock_request_id text,quantity integer,state text,customer_id text,product_id text,
      purpose text,delivery text,starts_at timestamptz,expires_at timestamptz,recipient_snapshot text,reason text,approval_instance_id text,
      requested_by text,version integer,created_at timestamptz,updated_at timestamptz);
    create table voucher.issuebatch(id text,order_id text,succeeded integer,failed integer);
    insert into voucher.stockrequest values
      ('stock:one','SR1','mall:one','product:one','pool:one','customer:one',10,'approved'),
      ('stock:two','SR2','mall:one','product:one','pool:empty','customer:one',2,'approved'),
      ('stock:foreign','SR3','mall:foreign','product:one','pool:one','customer:one',100,'approved');
    insert into voucher.credential values
      ('credential:1','mall:one','pool:one','product:one','available'),('credential:2','mall:one','pool:one','product:one','available'),
      ('credential:3','mall:one','pool:one','product:one','available'),('credential:4','mall:one','pool:one','product:one','allocated'),
      ('credential:foreign','mall:foreign','pool:one','product:one','available'),('credential:other','mall:one','pool:one','product:other','available');
    insert into voucher.issueorder(id,scope_id,stock_request_id,quantity,state,customer_id,product_id,purpose,delivery,starts_at,expires_at,recipient_snapshot,requested_by,version,created_at,updated_at)
      select id,'mall:one','stock:one',quantity,state,'customer:one','product:one','manual','claim','2026-09-05','2026-12-05','snapshot:one','actor:one',1,'2026-09-05','2026-09-05'
      from (values('issue:draft',2,'draft'),('issue:failed',3,'failed'),('issue:completed',2,'completed'),('issue:cancelled',50,'cancelled')) items(id,quantity,state);
    insert into voucher.issueorder(id,scope_id,stock_request_id,quantity,state) values('issue:foreign','mall:foreign','stock:one',100,'draft');`);
  return database;
}
