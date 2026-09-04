import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { describe, expect, it } from 'vitest';

const connection = process.env.SHOP_TEST_DATABASE_URL;
const endpointAvailable = connection !== undefined || process.env.PGHOST !== undefined;

describe.runIf(endpointAvailable)('Mall Identity isolation', () => {
  it('keeps Purchase, Payment, Fulfillment, and Inventory facts independent across two malls', async () => {
    const client = new Client({ ...(connection === undefined ? {} : { connectionString: connection }), connectionTimeoutMillis: 5_000,
      statement_timeout: 20_000 });
    const suffix = randomUUID();
    const mallA = `mall:isolation:a:${suffix}`;
    const mallB = `mall:isolation:b:${suffix}`;
    const member = `member:isolation:${suffix}`;
    const orderA = `order:isolation:a:${suffix}`;
    const orderB = `order:isolation:b:${suffix}`;
    const intentA = `intent:isolation:a:${suffix}`;
    const intentB = `intent:isolation:b:${suffix}`;
    const fulfillmentA = `fulfillment:isolation:a:${suffix}`;
    const fulfillmentB = `fulfillment:isolation:b:${suffix}`;
    const stockA = `stock:isolation:a:${suffix}`;
    const stockB = `stock:isolation:b:${suffix}`;
    const sharedReference = `shared:${suffix}`;

    await client.connect();
    try {
      await client.query('begin');
      await client.query(`insert into ordering.orderrecord(id,order_number,scope_id,member_id,mall_id,checkout_id,currency,total_minor,
        payment_state,fulfillment_state,aftersale_state,lifecycle_state,evidence,created_at,updated_at,version) values
        ($1,$2,$3,$4,$3,$5,'CNY',200,'unpaid','unallocated','none','active','{}',clock_timestamp(),clock_timestamp(),0),
        ($6,$7,$8,$4,$8,$9,'CNY',700,'unpaid','unallocated','none','active','{}',clock_timestamp(),clock_timestamp(),0)`,
      [orderA, `A-${suffix}`, mallA, member, `checkout:a:${suffix}`, orderB, `B-${suffix}`, mallB, `checkout:b:${suffix}`]);
      await client.query(`insert into ordering.line(id,order_id,sku_id,listing_id,title_snapshot,quantity,unit_minor,total_minor)
        values($1,$2,'sku:shared','listing:shared','Shared',2,100,200),($3,$4,'sku:shared','listing:shared','Shared',7,100,700)`,
      [`line:a:${suffix}`, orderA, `line:b:${suffix}`, orderB]);

      await client.query(`insert into payment.intent(id,mall_id,order_id,member_id,currency,amount_minor,state,idempotency_key,
        provider_reference,expires_at,version) values
        ($1,$2,$3,$4,'CNY',200,'created',$5,$6,clock_timestamp()+interval '30 minutes',0),
        ($7,$8,$9,$4,'CNY',700,'created',$5,$6,clock_timestamp()+interval '30 minutes',0)`,
      [intentA, mallA, orderA, member, sharedReference, `provider:${sharedReference}`, intentB, mallB, orderB]);
      await client.query(`insert into payment.recoverycase(id,scope_id,mall_id,order_id,resource_type,resource_id,severity,state,error_code,
        evidence,occurrence_count,opened_at) values
        ($1,$2,$2,$3,'intent',$4,'high','open','TEST','{}',1,clock_timestamp()),
        ($5,$6,$6,$7,'intent',$4,'high','open','TEST','{}',1,clock_timestamp())`,
      [`recovery:a:${suffix}`, mallA, orderA, sharedReference, `recovery:b:${suffix}`, mallB, orderB]);

      await client.query(`insert into fulfillment.fulfillmentorder(id,mall_id,member_id,provider_scope_id,order_id,suborder_id,provider,
        kind,state,external_reference,source_effect_id,created_at,updated_at,version) values
        ($1,$2,$3,$2,$4,$5,'shared','shipment','accepted',$6,$7,clock_timestamp(),clock_timestamp(),0),
        ($8,$9,$3,$9,$10,$5,'shared','shipment','accepted',$6,$7,clock_timestamp(),clock_timestamp(),0)`,
      [fulfillmentA, mallA, member, orderA, `suborder:${sharedReference}`, `external:${sharedReference}`, `effect:${sharedReference}`,
        fulfillmentB, mallB, orderB]);
      await client.query(`insert into fulfillment.returnrecord(id,mall_id,aftersale_id,fulfillment_id,state,version)
        values($1,$2,$3,$4,'authorized',0),($5,$6,$3,$7,'authorized',0)`,
      [`return:a:${suffix}`, mallA, `aftersale:${sharedReference}`, fulfillmentA, `return:b:${suffix}`, mallB, fulfillmentB]);

      await client.query(`insert into inventory.stockitem(id,scope_id,sku_id,location_id,onhand,safety,version,status,updated_at)
        values($1,$2,'sku:shared','location:shared',10,0,0,'active',clock_timestamp()),
          ($3,$4,'sku:shared','location:shared',10,0,0,'active',clock_timestamp())`, [stockA, mallA, stockB, mallB]);
      await client.query(`insert into inventory.reservation(id,mall_id,stockitem_id,owner_type,owner_id,quantity,state,expires_at,created_at,version)
        values($1,$2,$3,'order',$4,2,'active',clock_timestamp()+interval '30 minutes',clock_timestamp(),0),
          ($5,$6,$7,'order',$4,3,'active',clock_timestamp()+interval '30 minutes',clock_timestamp(),0)`,
      [`reservation:a:${suffix}`, mallA, stockA, sharedReference, `reservation:b:${suffix}`, mallB, stockB]);
      await client.query(`insert into inventory.movement(id,mall_id,stockitem_id,kind,quantity_delta,reference_type,reference_id,occurred_at)
        values($1,$2,$3,'reserve',-2,'order',$4,clock_timestamp()),($5,$6,$7,'reserve',-3,'order',$4,clock_timestamp())`,
      [`movement:a:${suffix}`, mallA, stockA, sharedReference, `movement:b:${suffix}`, mallB, stockB]);

      const purchases = await client.query<{ mall_id: string; quantity: number }>(`select orders.mall_id,sum(line.quantity)::float8 quantity
        from ordering.orderrecord orders join ordering.line line on line.order_id=orders.id
        where orders.mall_id=any($1::text[]) and orders.member_id=$2 and line.listing_id='listing:shared'
        group by orders.mall_id order by orders.mall_id`, [[mallA, mallB], member]);
      expect(new Map(purchases.rows.map(({ mall_id, quantity }) => [mall_id, quantity]))).toEqual(new Map([[mallA, 2], [mallB, 7]]));
      expect(Number((await client.query('select count(*) count from payment.intent where mall_id=$1 and id=$2', [mallA, intentA])).rows[0]?.count)).toBe(1);
      expect(Number((await client.query('select count(*) count from payment.intent where mall_id=$1 and id=$2', [mallA, intentB])).rows[0]?.count)).toBe(0);
      expect(Number((await client.query('select count(*) count from fulfillment.fulfillmentorder where mall_id=$1 and external_reference=$2',
        [mallA, `external:${sharedReference}`])).rows[0]?.count)).toBe(1);
      expect(Number((await client.query('select count(*) count from inventory.reservation where mall_id=$1 and owner_id=$2',
        [mallB, sharedReference])).rows[0]?.count)).toBe(1);

      await client.query("update payment.recoverycase set state='resolved',resolved_at=clock_timestamp() where mall_id=$1 and resource_id=$2", [mallA, sharedReference]);
      await client.query("update fulfillment.returnrecord set state='received',version=version+1 where mall_id=$1 and id=$2",
        [mallA, `return:a:${suffix}`]);
      await client.query("update inventory.reservation set state='released',version=version+1 where mall_id=$1 and owner_id=$2 and state='active'",
        [mallA, sharedReference]);

      expect((await client.query('select state from payment.recoverycase where mall_id=$1 and resource_id=$2', [mallB, sharedReference])).rows[0]?.state).toBe('open');
      expect((await client.query('select state from fulfillment.returnrecord where mall_id=$1 and id=$2', [mallB, `return:b:${suffix}`])).rows[0]?.state).toBe('authorized');
      expect((await client.query('select state from inventory.reservation where mall_id=$1 and owner_id=$2', [mallB, sharedReference])).rows[0]?.state).toBe('active');
    } finally {
      await client.query('rollback').catch(() => undefined);
      await client.end();
    }
  });
});
