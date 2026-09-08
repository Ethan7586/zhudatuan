import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it, vi } from 'vitest';
import type { ApprovalPort } from '../../approval/public';
import { result, withReadTransaction, withWriteTransaction } from '../../../test/TransactionFixture';
import { PgStockRequestRepository } from '../infrastructure/persistence/PgStockRequestRepository';
import { PgVoucherProductRepository } from '../infrastructure/persistence/PgVoucherProductRepository';
import { POOL_CAPACITY } from '../infrastructure/persistence/PoolCapacity';

describe('pool-level stock commitments', () => {
  it('subtracts outstanding requests once, retaining partial failures and excluding foreign scopes and products', async () => {
    const data = await fixture();
    try {
      expect(await data.capacity()).toEqual({ physical: 10, reserved: 7, available: 3 });
      // A successful retry removes one physical unit and one outstanding unit
      // atomically. It does not create or consume an extra stock commitment.
      await data.database.exec(`update voucher.issuebatch set succeeded=succeeded+1 where id='batch:partial';
        update voucher.credential set state='allocated' where id='credential:1';`);
      expect(await data.capacity()).toEqual({ physical: 9, reserved: 6, available: 3 });
    } finally {
      await data.database.close();
    }
  });

  it('refuses overcommit before creating approval and serializes successful submissions on the pool', async () => {
    const data = await fixture();
    try {
      await expect(data.submit()).rejects.toThrow('VOUCHER_STOCK_INSUFFICIENT');
      expect(data.request).not.toHaveBeenCalled();
      const sql = data.query.mock.calls.map(([statement]) => statement);
      expect(sql[0]).toContain('from voucher.stockrequest');
      expect(sql[1]).toBe('select state from voucher.credentialpool where id=$1 and scope_id=$2 for update');
      expect(sql.findIndex((statement) => statement === `${POOL_CAPACITY} where pool.id=$1 and pool.scope_id=$2`)).toBeGreaterThan(1);
      await data.database.exec(`update voucher.stockrequest set quantity=3 where id='stock:draft';`);
      expect((await data.submit()).body).toMatchObject({ state: 'submitted', approval: 'approval:new', quantity: 3, version: 2 });
      expect(await data.capacity()).toEqual({ physical: 10, reserved: 10, available: 0 });
      await expect(data.submit('stock:second')).rejects.toThrow('VOUCHER_STOCK_INSUFFICIENT');
      expect(data.request).toHaveBeenCalledOnce();
    } finally {
      await data.database.close();
    }
  });

  it('uses the same remaining supply for product choices and releases rejected reservations', async () => {
    const data = await fixture();
    try {
      const product = new PgVoucherProductRepository({ validate: vi.fn() });
      const options = () => withReadTransaction(data.query, (transaction) => product.options({ input: { query: {} }, context: { transaction }, scope: 'mall:one' } as never));
      expect((await options()).body.items).toEqual([{ id: 'product:one', number: 'VP1', name: '员工福利', faceMinor: 1000, currency: 'CNY', available: 3 }]);
      await data.database.exec(`update voucher.stockrequest set quantity=3 where id='stock:draft';`);
      await data.submit();
      expect((await options()).body.items).toEqual([]);
      await data.database.exec(`update voucher.stockrequest set state='rejected' where id='stock:pending';`);
      expect((await options()).body.items[0]?.available).toBe(2);
    } finally {
      await data.database.close();
    }
  });

  it.each(['closed pool', 'disabled product', 'decided request'] as const)('rechecks %s before creating an approval', async (state) => {
    const data = await fixture();
    try {
      const statement =
        state === 'closed pool'
          ? `update voucher.credentialpool set state='closed' where id='pool:one'`
          : state === 'disabled product'
            ? `update voucher.product set state='disabled' where id='product:one'`
            : `update voucher.stockrequest set state='approved' where id='stock:draft'`;
      await data.database.exec(statement);
      await expect(data.submit()).rejects.toThrow(state === 'closed pool' ? 'VOUCHER_POOL_CLOSED' : state === 'disabled product' ? 'VOUCHER_PRODUCT_INCOMPLETE' : 'VOUCHER_STATE_INVALID');
      expect(data.request).not.toHaveBeenCalled();
    } finally {
      await data.database.close();
    }
  });
});

async function fixture() {
  const database = new PGlite();
  await database.exec(`create schema voucher;
    create table voucher.credentialpool(id text primary key,scope_id text,product_id text,state text);
    create table voucher.product(id text primary key,number text,scope_id text,customer_id text,pool_id text,name text,face_minor integer,currency text,state text);
    create table voucher.credential(id text primary key,scope_id text,pool_id text,product_id text,state text);
    create table voucher.stockrequest(id text primary key,number text,scope_id text,product_id text,pool_id text,customer_id text,quantity integer,state text,
      reason text default '员工福利',requested_by text default 'actor:one',approval_instance_id text,version integer default 1,created_at timestamptz default now(),updated_at timestamptz default now());
    create table voucher.issueorder(id text primary key,scope_id text,stock_request_id text,product_id text);
    create table voucher.issuebatch(id text primary key,order_id text,scope_id text,succeeded integer,state text);
    insert into voucher.credentialpool values('pool:one','mall:one','product:one','open');
    insert into voucher.product values('product:one','VP1','mall:one','customer:one','pool:one','员工福利',1000,'CNY','enabled');
    insert into voucher.credential select 'credential:'||ordinal,'mall:one','pool:one','product:one','available' from generate_series(1,10) ordinal;
    insert into voucher.credential values('credential:allocated','mall:one','pool:one','product:one','allocated'),
      ('credential:foreign','mall:other','pool:one','product:one','available'),('credential:other','mall:one','pool:one','product:other','available');
    insert into voucher.stockrequest(id,number,scope_id,product_id,pool_id,customer_id,quantity,state) select id,id,'mall:one','product:one','pool:one','customer:one',quantity,state
      from (values('stock:approved',8,'approved'),('stock:pending',2,'submitted'),('stock:fulfilled',4,'fulfilled'),
        ('stock:rejected',100,'rejected'),('stock:cancelled',100,'cancelled'),('stock:draft',4,'draft'),('stock:second',1,'draft')) requests(id,quantity,state);
    insert into voucher.stockrequest(id,scope_id,product_id,pool_id,quantity,state) values('stock:foreign','mall:other','product:one','pool:one',100,'approved'),
      ('stock:other','mall:one','product:other','pool:one',100,'approved');
    insert into voucher.issueorder values('issue:partial','mall:one','stock:approved','product:one'),('issue:complete','mall:one','stock:fulfilled','product:one'),
      ('issue:foreign','mall:other','stock:approved','product:one');
    insert into voucher.issuebatch values('batch:partial','issue:partial','mall:one',3,'failed'),('batch:complete','issue:complete','mall:one',4,'completed'),
      ('batch:foreign','issue:foreign','mall:other',99,'completed');`);
  const query = vi.fn(async (sql: string, values?: readonly unknown[]) => {
    const executed = await database.query<Record<string, unknown>>(sql, values ? [...values] : []);
    return { ...result(executed.rows), rowCount: executed.affectedRows ?? executed.rows.length };
  });
  const request = vi.fn(async () => ({ instanceId: 'approval:new' }));
  const repository = new PgStockRequestRepository({ request } as unknown as ApprovalPort, {} as never);
  return {
    database,
    query,
    request,
    capacity: async () => {
      const row = (await database.query<{ physical: number; reserved: number; available: number }>(`${POOL_CAPACITY} where pool.id='pool:one'`)).rows[0]!;
      return { physical: row.physical, reserved: row.reserved, available: row.available };
    },
    submit: (id = 'stock:draft') =>
      withWriteTransaction(query, (transaction) => repository.submit({ input: { path: { requestid: id } }, context: { transaction }, scope: 'mall:one', actor: 'actor:one', now: new Date(), expectedVersion: 1 } as never)),
  };
}
