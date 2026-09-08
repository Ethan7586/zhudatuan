import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import type { PoolClient } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import { RUNTIME_LIMITS } from '@shop/config/runtime';
import { PgTransactionManager } from '../../../platform/database/PgTransactionManager';
import type { DatabasePool } from '../../../platform/database/Pool';
import { result } from '../../../test/TransactionFixture';
import { VoucherTenderWriter } from '../infrastructure/persistence/VoucherTenderWriter';
import { VoucherRedemptionWriter } from '../infrastructure/persistence/VoucherRedemptionWriter';
import { VoucherRefundWriter } from '../infrastructure/persistence/VoucherRefundWriter';
import { VoucherPort } from '../infrastructure/persistence/VoucherPort';
import { PgTenderRepository } from '../infrastructure/persistence/PgTenderRepository';
import type { OrganizationReadPort } from '../../organization/public';

const original = readFileSync(new URL('../../../../../../database/migrations/20260904028200_prepare_voucher.sql', import.meta.url), 'utf8');
const migration = readFileSync(new URL('../../../../../../database/migrations/20260904028900_prepare_voucher_tenders.sql', import.meta.url), 'utf8');
const schema = original.slice(original.indexOf('create table voucher.product('), original.indexOf('insert into voucher.product('));
const holdGuard = original.slice(original.indexOf('create function voucher.guard_hold_transition()'), original.indexOf('create function voucher.guard_redemption_refund()'));
const refundGuard = original.slice(original.indexOf('create function voucher.guard_redemption_refund()'), original.indexOf('create trigger voucher_refund_immutable'));
const holderGuard = original.slice(original.indexOf('create function voucher.guard_holder_transition()'), original.indexOf('create function voucher.create_refund('));
const voucherGuard = original.slice(original.indexOf('create function voucher.guard_voucher_transition()'), original.indexOf('create function voucher.guard_batch_transition()'));
const tenders = migration.slice(migration.indexOf('alter table voucher.voucher add constraint'), migration.indexOf('select runtime.record_migration_evidence'));
const eventMigration = readFileSync(new URL('../../../../../../database/migrations/20260904029000_publish_voucher_redemption.sql', import.meta.url), 'utf8');
const events = eventMigration.slice(eventMigration.indexOf('update runtime.event set retired_at'), eventMigration.indexOf('select runtime.record_migration_evidence'));
const refundMigration = readFileSync(new URL('../../../../../../database/migrations/20260904029100_prepare_voucher_refunds.sql', import.meta.url), 'utf8');
const refunds = refundMigration.slice(refundMigration.indexOf('alter table voucher.holder add constraint'), refundMigration.indexOf('select runtime.record_migration_evidence'));
const refundEventMigration = readFileSync(new URL('../../../../../../database/migrations/20260904029300_publish_voucher_refunds.sql', import.meta.url), 'utf8');
const refundEvents = refundEventMigration.slice(refundEventMigration.indexOf('alter table voucher.redemption add column'), refundEventMigration.indexOf('select runtime.record_migration_evidence'));
const runtimeEventMigration = readFileSync(new URL('../../../../../../database/migrations/20260904022000_prepare_inventory.sql', import.meta.url), 'utf8');
const eventGuard = runtimeEventMigration.slice(runtimeEventMigration.indexOf('create function runtime.guard_event_version()'), runtimeEventMigration.indexOf('insert into runtime.event', runtimeEventMigration.indexOf('create function runtime.guard_event_version()')));

describe('one voucher tender writer', () => {
  it('shares reservation and release across checkout and operations with a single immutable timeline', async () => {
    const data = await fixture();
    try {
      await data.checkout();
      const [hold] = await data.holds();
      expect(hold).toMatchObject({ owner_id: 'order:one', amount_minor: 400, state: 'active', version: 1 });
      await data.checkout();
      expect(await data.holds()).toHaveLength(1);
      await data.apiRelease(hold!.id);
      await data.apiRelease(hold!.id);
      expect(await data.states()).toEqual([{ id: 'voucher:one', state: 'active', remaining_minor: 1000, version: 4 }]);
      expect(await data.history()).toEqual([
        { previous_state: 'active', next_state: 'held' },
        { previous_state: 'held', next_state: 'active' },
      ]);
      expect(data.post).not.toHaveBeenCalled();
    } finally {
      await data.database.close();
    }
  });

  it('caps TTL at the shared limit and the voucher expiry and refuses expired reservation replays', async () => {
    const data = await fixture();
    try {
      const expires = new Date(data.now.getTime() + 90_000);
      await data.database.query(`update voucher.voucher set expires_at=$1,version=version+1`, [expires]);
      const first = await data.reserve({ ttlSeconds: RUNTIME_LIMITS.voucherTender.holdTtlSeconds * 2 });
      expect(first.hold.expiresAt).toBe(expires.toISOString());
      await expect(data.reserve({ now: expires })).rejects.toThrow('VOUCHER_HOLD_EXPIRED');
      await data.release(first.hold.id, { now: expires });
      expect((await data.states())[0]).toMatchObject({ state: 'expired', remaining_minor: 1000 });
      expect((await data.holds())[0]?.state).toBe('expired');
    } finally {
      await data.database.close();
    }
  });

  it('rejects noninteger or nonpositive amounts and TTL before writing', async () => {
    const data = await fixture();
    try {
      for (const amountMinor of [0, -1, 0.5, Number.MAX_SAFE_INTEGER + 1]) await expect(data.reserve({ amountMinor })).rejects.toThrow('VALIDATION_FAILED');
      for (const ttlSeconds of [0, -1, 1.1, Infinity]) await expect(data.reserve({ ttlSeconds })).rejects.toThrow('VALIDATION_FAILED');
      expect(await data.holds()).toEqual([]);
      expect(await data.history()).toEqual([]);
    } finally {
      await data.database.close();
    }
  });

  it('binds reservation replay to voucher, owner, amount and currently authorized holder', async () => {
    const data = await fixture();
    try {
      await data.reserve();
      await expect(data.reserve({ owner: 'order:other' })).rejects.toThrow('VOUCHER_HOLD_CONFLICT');
      await expect(data.reserve({ amountMinor: 401 })).rejects.toThrow('VOUCHER_HOLD_CONFLICT');
      await expect(data.reserve({ member: 'member:other' })).rejects.toThrow('VOUCHER_NOT_USABLE');
      await data.add('voucher:two');
      await expect(data.reserve({ voucher: 'voucher:two' })).rejects.toThrow('VOUCHER_HOLD_CONFLICT');
      expect(await data.holds()).toHaveLength(1);
    } finally {
      await data.database.close();
    }
  });

  it('enforces one active reservation and starts a new business key only after release', async () => {
    const data = await fixture();
    try {
      const first = await data.reserve();
      await expect(data.reserve({ idempotency: 'hold:second' })).rejects.toThrow('VOUCHER_NOT_USABLE');
      await data.release(first.hold.id);
      await expect(data.reserve()).rejects.toThrow('VOUCHER_HOLD_CONFLICT');
      const second = await data.reserve({ idempotency: 'hold:second' });
      expect(second.hold.id).not.toBe(first.hold.id);
      expect((await data.holds()).map((hold) => hold.state).sort()).toEqual(['active', 'released']);
    } finally {
      await data.database.close();
    }
  });

  it('consumes once, rejects release after consume and rejects rebinding the receipt to another hold/order', async () => {
    const data = await fixture();
    try {
      const hold = (await data.reserve()).hold;
      const redeemed = await data.consume(hold.id);
      expect((await data.consume(hold.id)).id).toBe(redeemed.id);
      await expect(data.release(hold.id)).rejects.toThrow('VOUCHER_HOLD_CONFLICT');
      await expect(data.consume(hold.id, { order: 'order:other' })).rejects.toThrow('VOUCHER_REDEMPTION_CONFLICT');
      await expect(data.consume('hold:other')).rejects.toThrow('VOUCHER_REDEMPTION_CONFLICT');
      expect((await data.states())[0]).toMatchObject({ state: 'active', remaining_minor: 600 });
      expect(data.post).toHaveBeenCalledTimes(1);
      expect(await data.history()).toHaveLength(2);
      const [event] = await data.events();
      expect(event).toMatchObject({ event_version: 2, actor_id: 'principal:one', aggregate_id: 'voucher:one', payload: { scope: 'scope:test', channel: 'order', store: null, order: 'order:one', amountMinor: 400, currency: 'CNY' } });
      expect(data.post).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ source: expect.objectContaining({ eventId: event!.id }) }));
      expect(await data.events()).toHaveLength(1);
    } finally {
      await data.database.close();
    }
  });

  it('never consumes a released or expired reservation and leaves both balance and accounting unchanged', async () => {
    const data = await fixture();
    try {
      const hold = (await data.reserve()).hold;
      await expect(data.consume(hold.id, { now: new Date(hold.expiresAt) })).rejects.toThrow('VOUCHER_HOLD_EXPIRED');
      await data.release(hold.id);
      await expect(data.consume(hold.id)).rejects.toThrow('VOUCHER_HOLD_CONFLICT');
      expect((await data.states())[0]?.remaining_minor).toBe(1000);
      expect(data.post).not.toHaveBeenCalled();
    } finally {
      await data.database.close();
    }
  });

  it('rolls back hold consumption, balance and timeline when accounting fails', async () => {
    const data = await fixture();
    try {
      const hold = (await data.reserve()).hold;
      data.post.mockRejectedValueOnce(new Error('ACCOUNTING_UNAVAILABLE'));
      await expect(data.consume(hold.id)).rejects.toThrow('ACCOUNTING_UNAVAILABLE');
      expect((await data.states())[0]).toMatchObject({ state: 'held', remaining_minor: 1000 });
      expect((await data.holds())[0]?.state).toBe('active');
      expect(await data.history()).toHaveLength(1);
      expect((await data.database.query(`select id from voucher.redemption`)).rows).toEqual([]);
      expect(await data.events()).toEqual([]);
      await data.consume(hold.id);
      expect((await data.states())[0]?.remaining_minor).toBe(600);
    } finally {
      await data.database.close();
    }
  });

  it('rejects stale hold versions before release or consumption', async () => {
    const data = await fixture();
    try {
      const hold = (await data.reserve()).hold;
      await expect(data.release(hold.id, { expectedVersion: 2 })).rejects.toThrow('VERSION_CONFLICT');
      await expect(data.consume(hold.id, { expectedHoldVersion: 2 })).rejects.toThrow('VERSION_CONFLICT');
      expect((await data.holds())[0]?.state).toBe('active');
      expect((await data.states())[0]?.remaining_minor).toBe(1000);
      expect(data.post).not.toHaveBeenCalled();
      await data.consume(hold.id, { expectedHoldVersion: 1 });
    } finally {
      await data.database.close();
    }
  });

  it('locks the voucher before any hold lock in reserve, payment consumption and release', async () => {
    const data = await fixture();
    try {
      await data.checkout();
      assertLockOrder(data.query.mock.calls);
      data.query.mockClear();
      await data.paymentConsume();
      assertLockOrder(data.query.mock.calls);
      await data.add('voucher:two');
      const second = await data.reserve({ voucher: 'voucher:two', idempotency: 'second' });
      data.query.mockClear();
      await data.release(second.hold.id);
      assertLockOrder(data.query.mock.calls);
    } finally {
      await data.database.close();
    }
  });

  it('does not reactivate a reservation that a payment has already consumed during cancellation', async () => {
    const data = await fixture();
    try {
      await data.checkout();
      await data.paymentConsume();
      await data.paymentRelease();
      await data.paymentConsume();
      expect((await data.states())[0]?.remaining_minor).toBe(600);
      expect(data.post).toHaveBeenCalledTimes(1);
    } finally {
      await data.database.close();
    }
  });

  it('rejects cross-scope access even with a broad database identity', async () => {
    const data = await fixture();
    try {
      const hold = (await data.reserve()).hold;
      await expect(data.reserve({ scope: 'scope:other' })).rejects.toThrow('VOUCHER_NOT_USABLE');
      await expect(data.release(hold.id, { scope: 'scope:other' })).rejects.toThrow('RESOURCE_NOT_FOUND');
      await expect(data.consume(hold.id, { scope: 'scope:other' })).rejects.toThrow('VOUCHER_NOT_REDEEMABLE');
      await data.paymentRelease('scope:other');
      await expect(data.paymentConsume('scope:other')).rejects.toThrow('VOUCHER_HOLD_CONFLICT');
      expect((await data.holds())[0]?.state).toBe('active');
      expect(data.post).not.toHaveBeenCalled();
    } finally {
      await data.database.close();
    }
  });

  it('makes hold economic terms immutable and rejects foreign-parent redemptions in SQL', async () => {
    const data = await fixture();
    try {
      const hold = (await data.reserve()).hold;
      for (const assignment of [`voucher_id='voucher:other'`, `owner_id='order:other'`, `scope_id='scope:other'`, `amount_minor=900`, `expires_at=expires_at+interval '1 minute'`, `idempotency_key='forged'`]) {
        await expect(data.database.query(`update voucher.tenderhold set ${assignment},version=version+1 where id=$1`, [hold.id])).rejects.toThrow('VOUCHER_HOLD_FROZEN');
      }
      await data.add('voucher:two');
      await expect(
        data.database.query(
          `insert into voucher.redemption(id,scope_id,voucher_id,hold_id,verification_id,order_id,amount_minor,refunded_minor,currency,state,idempotency_key,version,redeemed_at,updated_at,channel,reporting_scopes,timezone)
        values('redemption:forged','scope:test','voucher:two',$1,'verify:forged',null,400,0,'CNY','succeeded','forged',1,now(),now(),'manual',array['scope:test'],'Asia/Shanghai')`,
          [hold.id]
        )
      ).rejects.toThrow(/voucher_redemption_hold_scope/);
    } finally {
      await data.database.close();
    }
  });

  it('replays full-value verification from the receipt after balance reaches zero and the voucher expires', async () => {
    const data = await fixture();
    try {
      const receipt = await data.verify();
      expect(receipt).toMatchObject({ amountMinor: 1000 });
      expect((await data.states())[0]).toMatchObject({ state: 'redeemed', remaining_minor: 0 });
      expect(await data.verify()).toEqual(receipt);
      await data.database.exec(`update voucher.voucher set expires_at=now()-interval '1 second',version=version+1`);
      expect(await data.verify()).toEqual(receipt);
      expect(data.post).toHaveBeenCalledTimes(1);
      expect(await data.history()).toHaveLength(1);
      expect(await data.events()).toHaveLength(1);
      expect((await data.events())[0]).toMatchObject({
        event_version: 2,
        payload: { scope: 'scope:test', channel: 'store', store: 'store:one', order: null, amountMinor: 1000, scopes: ['scope:test', 'scope:group', 'store:one'], timezone: 'Asia/Shanghai' },
      });
    } finally {
      await data.database.close();
    }
  });

  it('binds verified receipts to the original voucher and scope without exposing a foreign receipt', async () => {
    const data = await fixture();
    try {
      await data.verify();
      await data.add('voucher:two');
      await expect(data.verify({ voucher: 'voucher:two' })).rejects.toThrow('VOUCHER_REDEMPTION_CONFLICT');
      expect(await data.verify({ scope: 'scope:other' })).toBeNull();
      expect(await data.verify({ verification: 'verification:other' })).toBeNull();
      expect(data.post).toHaveBeenCalledTimes(1);
    } finally {
      await data.database.close();
    }
  });

  it('cannot bypass an active hold with atomic verification', async () => {
    const data = await fixture();
    try {
      await data.reserve();
      expect(await data.verify()).toBeNull();
      expect((await data.states())[0]).toMatchObject({ state: 'held', remaining_minor: 1000 });
      expect(data.post).not.toHaveBeenCalled();
    } finally {
      await data.database.close();
    }
  });

  it('rolls back monetary facts and stops accounting when the transactional event cannot be stored', async () => {
    const data = await fixture();
    try {
      const hold = (await data.reserve()).hold;
      await data.database.exec(`alter table runtime.outbox add constraint eventunavailable check(false) not valid`);
      await expect(data.consume(hold.id)).rejects.toThrow(/eventunavailable/);
      expect((await data.states())[0]).toMatchObject({ state: 'held', remaining_minor: 1000 });
      expect((await data.holds())[0]?.state).toBe('active');
      expect((await data.database.query(`select id from voucher.redemption`)).rows).toEqual([]);
      expect(await data.events()).toEqual([]);
      expect(data.post).not.toHaveBeenCalled();
    } finally {
      await data.database.close();
    }
  });

  it('rejects a spoofed store and an unrelated organization before publishing a redemption', async () => {
    const data = await fixture();
    try {
      await expect(data.verify({ store: 'store:other' })).rejects.toThrow('SCOPE_DENIED');
      data.scope.mockImplementation(async (_context, id) => ({ id, scopeKind: id.startsWith('store:') ? 'store' : 'mall', timezone: 'Asia/Shanghai', tenant: 'scope:other', ancestors: [], descendants: [] }));
      await expect(data.verify()).rejects.toThrow('SCOPE_DENIED');
      expect((await data.states())[0]).toMatchObject({ state: 'active', remaining_minor: 1000 });
      expect(await data.events()).toEqual([]);
      expect(data.post).not.toHaveBeenCalled();
    } finally {
      await data.database.close();
    }
  });

  it('rejects a runtime event whose monetary payload differs from the persisted redemption', async () => {
    const data = await fixture();
    try {
      await data.verify();
      await expect(
        data.database.query(`insert into runtime.outbox select id,event_type,event_version,aggregate_type,aggregate_id,aggregate_version,
        scope_id,jsonb_set(payload,'{amountMinor}','999'::jsonb),trace_id,actor_id,correlation_id,causation_id,payload_version,occurred_at,available_at from runtime.outbox`)
      ).rejects.toThrow('VOUCHER_REDEMPTION_EVENT_FACT_INVALID');
      await expect(
        data.database.query(`insert into runtime.outbox select id,event_type,1,aggregate_type,aggregate_id,aggregate_version,
        scope_id,payload,trace_id,actor_id,correlation_id,causation_id,1,occurred_at,available_at from runtime.outbox`)
      ).rejects.toThrow('EVENT_VERSION_INACTIVE');
      expect(await data.events()).toHaveLength(1);
    } finally {
      await data.database.close();
    }
  });

  it('refunds the historical payer and replays their receipt after the voucher is rebound to someone else', async () => {
    const data = await fixture();
    try {
      await data.checkout();
      await data.paymentConsume();
      await data.paymentRefund();
      expect((await data.states())[0]?.remaining_minor).toBe(1000);
      await data.rebind();
      await data.paymentRefund();
      await expect(data.paymentRefund({ member: 'member:other' })).rejects.toThrow('RESOURCE_NOT_FOUND');
      expect(
        (
          await data.database.query(`select redemption.holder_id,holder.member_id,holder.state from voucher.redemption redemption
        join voucher.holder holder on holder.id=redemption.holder_id`)
        ).rows
      ).toEqual([{ holder_id: 'voucher:one:holder', member_id: 'member:one', state: 'released' }]);
      expect((await data.database.query(`select amount_minor::integer,rule_version::integer from voucher.refund`)).rows).toEqual([{ amount_minor: 400, rule_version: 1 }]);
      expect(data.post).toHaveBeenCalledTimes(2);
      const refundEvents = (await data.events()).filter((event) => event.event_type === 'voucher.refunded');
      expect(refundEvents).toHaveLength(1);
      expect(refundEvents[0]).toMatchObject({ payload: { amountMinor: 400, ruleVersion: 1, channel: 'order', order: 'order:one', scope: 'scope:test' } });
      expect(data.post).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ source: expect.objectContaining({ eventId: refundEvents[0]!.id }) }));
    } finally {
      await data.database.close();
    }
  });

  it('keeps partial refunds bounded and locks the voucher before the redemption', async () => {
    const data = await fixture();
    try {
      await data.checkout();
      await data.paymentConsume();
      data.query.mockClear();
      await data.paymentRefund({ amountMinor: 100 });
      const locks = data.query.mock.calls.map(([sql]) => sql).filter((sql) => /for update/.test(sql));
      expect(locks[0]).toContain('from voucher.voucher where');
      expect(locks[1]).toContain('for update of redemption');
      await expect(data.paymentRefund({ amountMinor: 101 })).rejects.toThrow('VOUCHER_REDEMPTION_CONFLICT');
      await expect(data.paymentRefund({ refund: 'refund:over', amountMinor: 301 })).rejects.toThrow('VOUCHER_REFUND_EXCEEDS_REDEMPTION');
      await data.paymentRefund({ refund: 'refund:rest', amountMinor: 300 });
      expect((await data.states())[0]?.remaining_minor).toBe(1000);
      expect((await data.database.query(`select refunded_minor::integer,state from voucher.redemption`)).rows).toEqual([{ refunded_minor: 400, state: 'refunded' }]);
      expect(data.post).toHaveBeenCalledTimes(3);
    } finally {
      await data.database.close();
    }
  });

  it('rolls back a refund ledger and restored balance if the accounting reversal fails', async () => {
    const data = await fixture();
    try {
      await data.checkout();
      await data.paymentConsume();
      data.post.mockRejectedValueOnce(new Error('ACCOUNTING_UNAVAILABLE'));
      await expect(data.paymentRefund()).rejects.toThrow('ACCOUNTING_UNAVAILABLE');
      expect((await data.states())[0]?.remaining_minor).toBe(600);
      expect((await data.database.query(`select id from voucher.refund`)).rows).toEqual([]);
      expect((await data.database.query(`select refunded_minor::integer from voucher.redemption`)).rows).toEqual([{ refunded_minor: 0 }]);
      expect((await data.events()).filter((event) => event.event_type === 'voucher.refunded')).toEqual([]);
      await data.paymentRefund();
      expect((await data.states())[0]?.remaining_minor).toBe(1000);
    } finally {
      await data.database.close();
    }
  });

  it('protects historical holder and redemption identity in SQL and rejects cross-scope payment refunds', async () => {
    const data = await fixture();
    try {
      await data.checkout();
      await data.paymentConsume();
      await expect(data.paymentRefund({}, 'scope:other')).rejects.toThrow('RESOURCE_NOT_FOUND');
      for (const assignment of [`holder_id=null`, `order_id='order:other'`, `verification_id='verification:other'`, `amount_minor=500`]) {
        await expect(data.database.exec(`update voucher.redemption set ${assignment},version=version+1`)).rejects.toThrow('VOUCHER_REDEMPTION_IMMUTABLE');
      }
      for (const assignment of [`scope_id='scope:other'`, `member_id='member:other'`, `bound_at=now()-interval '1 year'`]) {
        await expect(data.database.exec(`update voucher.holder set ${assignment},version=version+1`)).rejects.toThrow('VOUCHER_HOLDER_IMMUTABLE');
      }
      expect((await data.states())[0]?.remaining_minor).toBe(600);
    } finally {
      await data.database.close();
    }
  });

  it('rejects independently forged refund receipts and cumulative totals at the database transaction boundary', async () => {
    const data = await fixture();
    try {
      await data.checkout();
      await data.paymentConsume();
      await expect(
        data.database.exec(`insert into voucher.refund(id,scope_id,redemption_id,amount_minor,currency,reason,state,rule_version,idempotency_key,created_at)
        select 'refund:forged',scope_id,id,100,currency,'伪造退款','succeeded',1,'forged',now() from voucher.redemption`)
      ).rejects.toThrow('VOUCHER_REFUND_TOTAL_MISMATCH');
      await expect(data.database.exec(`update voucher.redemption set refunded_minor=100,state='partiallyrefunded',version=version+1`)).rejects.toThrow('VOUCHER_REFUND_TOTAL_MISMATCH');
      expect((await data.database.query(`select id from voucher.refund`)).rows).toEqual([]);
      expect((await data.database.query(`select refunded_minor::integer from voucher.redemption`)).rows).toEqual([{ refunded_minor: 0 }]);
      await data.paymentRefund();
    } finally {
      await data.database.close();
    }
  });
});

describe('voucher refund facts', () => {
  it('reuses the original store and scope snapshot after organization settings change', async () => {
    const data = await fixture();
    try {
      const redemption = await data.verify();
      const original = (await data.events())[0]!;
      data.scope.mockImplementation(async (_context, id) => ({ id, scopeKind: 'mall', timezone: 'UTC', tenant: 'scope:other', ancestors: ['scope:other'], descendants: [] }));
      const refund = await data.refund(redemption!.id, 400);
      await data.refund(redemption!.id, 400);
      const event = (await data.events()).find((event) => event.event_type === 'voucher.refunded')!;
      expect(event).toMatchObject({
        id: `event:voucher:refund:${refund}`,
        payload: { redemption: redemption!.id, amountMinor: 400, channel: 'store', store: 'store:one', scopes: original.payload.scopes, timezone: 'Asia/Shanghai', currency: 'CNY' },
      });
      expect(await data.events()).toHaveLength(2);
      expect(data.post).toHaveBeenCalledTimes(2);
      for (const assignment of ["store_id='store:other'", "reporting_scopes=array['scope:other']", "timezone='UTC'"]) {
        await expect(data.database.exec(`update voucher.redemption set ${assignment}`)).rejects.toThrow('VOUCHER_REDEMPTION_CONTEXT_IMMUTABLE');
      }
    } finally {
      await data.database.close();
    }
  });

  it('rolls back refund value and receipt when the refund event cannot be written', async () => {
    const data = await fixture();
    try {
      await data.checkout();
      await data.paymentConsume();
      await data.database.exec(`update runtime.event set retired_at=now() where type='voucher.refunded'`);
      await expect(data.paymentRefund()).rejects.toThrow('EVENT_VERSION_INACTIVE');
      expect((await data.states())[0]?.remaining_minor).toBe(600);
      expect((await data.database.query(`select refunded_minor::integer from voucher.redemption`)).rows).toEqual([{ refunded_minor: 0 }]);
      expect((await data.database.query(`select id from voucher.refund`)).rows).toEqual([]);
      expect(await data.events()).toHaveLength(1);
      expect(data.post).toHaveBeenCalledTimes(1);
    } finally {
      await data.database.close();
    }
  });

  it('rejects forged amounts, rule versions and scopes against persisted refund receipts', async () => {
    const data = await fixture();
    try {
      await data.checkout();
      await data.paymentConsume();
      await data.paymentRefund();
      for (const [field, value] of [
        ['amountMinor', '1'],
        ['ruleVersion', '2'],
        ['scopes', '["scope:other"]'],
      ] as const) {
        await expect(
          data.database.query(
            `insert into runtime.outbox select id,event_type,event_version,aggregate_type,aggregate_id,aggregate_version,
          scope_id,jsonb_set(payload,$1::text[],$2::jsonb),trace_id,actor_id,correlation_id,causation_id,payload_version,occurred_at,available_at
          from runtime.outbox where event_type='voucher.refunded'`,
            [[field], value]
          )
        ).rejects.toThrow('VOUCHER_REFUND_EVENT_FACT_INVALID');
      }
      expect(await data.events()).toHaveLength(2);
    } finally {
      await data.database.close();
    }
  });
});

function assertLockOrder(calls: readonly (readonly [string, ...unknown[]])[]) {
  const locks = calls.map(([sql]) => sql).filter((sql) => /for update/i.test(sql));
  expect(locks[0]).toMatch(/from voucher.voucher voucher|from voucher.voucher where/);
  expect(locks.findIndex((sql) => /from voucher\.tenderhold(?: hold)? where/.test(sql))).toBeGreaterThan(0);
}

async function fixture() {
  const database = new PGlite();
  const now = new Date();
  await database.exec(`create schema voucher; ${schema} ${holdGuard} ${voucherGuard} ${holderGuard} ${refundGuard} ${tenders} ${refunds}
    create schema runtime;
    create table runtime.event(type text,version integer,owner text,schema_ref text,retired_at timestamptz,primary key(type,version));
    create table runtime.inbox(event_type text,event_version integer,foreign key(event_type,event_version) references runtime.event(type,version));
    create table runtime.outbox(id text primary key,event_type text,event_version integer,aggregate_type text,aggregate_id text,aggregate_version bigint,
      scope_id text,payload jsonb,trace_id text,actor_id text,correlation_id text,causation_id text,payload_version integer,occurred_at timestamptz,available_at timestamptz,
      foreign key(event_type,event_version) references runtime.event(type,version));
    ${eventGuard} ${events} ${refundEvents}
    insert into voucher.product values('product:one','VP1','scope:test','customer:one','福利卡',1000,'CNY','qualification:one',null,
      now()-interval '1 day',now()+interval '1 year','secret',true,'disabled',1,now(),now());
    insert into voucher.credentialpool values('pool:one','CP1','scope:test','product:one','卡号库','generated','VC',100,0,'open',1,now(),now());
    insert into voucher.stockrequest values('stock:one','SR1','scope:test','customer:one','product:one','pool:one',2,'福利卡','approved','approval:stock','principal:one',1,now(),now());
    insert into voucher.issueorder values('issue:one','IO1','scope:test','customer:one','product:one','stock:one',2,'benefit','account',now()-interval '1 day',now()+interval '1 day','member:one','福利卡','completed','approval:issue','principal:one',1,now(),now());
    insert into voucher.issuebatch(id,order_id,scope_id,state,requested,processed,succeeded,accounted,failed,retryable,version,created_at,updated_at)
      values('batch:one','issue:one','scope:test','completed',2,2,2,2,0,0,1,now(),now());`);
  const add = async (id: string) => {
    const fingerprint = createHash('sha256').update(id).digest('hex');
    await database.query(
      `insert into voucher.credential(id,scope_id,pool_id,product_id,number_ciphertext,secret_ciphertext,number_fingerprint,secret_fingerprint,number_masked,key_version,state,issue_batch_id,version,created_at,updated_at)
      values($1,'scope:test','pool:one','product:one','cipher','cipher',$2,$2,'****1234','key:one','allocated','batch:one',1,now(),now())`,
      [id + ':credential', fingerprint]
    );
    await database.query(
      `insert into voucher.voucher values($1,'scope:test','product:one',$2,null,$3,'****1234',1000,1000,'CNY','active',
      now()-interval '1 day',now()+interval '1 day',1,now(),now())`,
      [id, id + ':credential', fingerprint]
    );
    await database.query(`insert into voucher.holder values($1,'scope:test',$2,'member:one','bound',1,now(),null)`, [id + ':holder', id]);
    await database.query(`update voucher.voucher set holder_id=$2,version=version+1 where id=$1`, [id, id + ':holder']);
  };
  await add('voucher:one');
  const query = vi.fn(async (sql: string, values?: readonly unknown[]) => {
    const response = await database.query<Record<string, unknown>>(sql, values ? [...values] : []);
    return { ...result(response.rows), rowCount: response.affectedRows ?? response.rows.length };
  });
  const client = { query, release: () => undefined } as unknown as PoolClient;
  const pool: DatabasePool = { connect: async () => client, query: query as DatabasePool['query'], workload: () => pool, end: async () => undefined };
  const manager = new PgTransactionManager(pool);
  const post = vi.fn(async () => 'journal:one');
  const scope = vi.fn<OrganizationReadPort['scope']>(async (_context, id) => ({
    id,
    scopeKind: id.startsWith('store:') ? 'store' : 'mall',
    timezone: 'Asia/Shanghai',
    tenant: 'scope:group',
    ancestors: id.startsWith('store:') ? ['scope:test', 'scope:group'] : ['scope:group'],
    descendants: [],
  }));
  const organizations = { scope };
  const writer = new VoucherTenderWriter();
  const redeemer = new VoucherRedemptionWriter({ post }, organizations);
  const port = new VoucherPort({ post }, organizations);
  const repository = new PgTenderRepository({ post }, organizations);
  const options = (scope = 'scope:test') => ({
    scope,
    tenant: scope,
    membership: 'membership:one',
    actor: 'principal:one',
    trace: 'trace:one',
    operation: 'voucher.tenderholds.create',
    signal: new AbortController().signal,
    deadline: Date.now() + 20_000,
  });
  const base = { scope: 'scope:test', now, actor: 'principal:one' };
  return {
    database,
    now,
    query,
    post,
    add,
    scope,
    refund: (redemption: string, amountMinor: number) =>
      manager.write({ ...options(), operation: 'voucher.refunds.create' }, (context) => new VoucherRefundWriter({ post }).refund({ context, ...base, redemption, amountMinor, reason: '核销退款', idempotency: 'refund:manual' })),
    reserve: (change: Partial<Omit<Parameters<VoucherTenderWriter['reserve']>[0], 'context'>> = {}) =>
      manager.write(options(), (context) =>
        writer.reserve({
          context,
          ...base,
          voucher: 'voucher:one',
          owner: 'order:one',
          member: 'member:one',
          amountMinor: 400,
          ttlSeconds: 60,
          idempotency: 'hold:one',
          ...change,
        })
      ),
    release: (hold: string, change: Partial<Omit<Parameters<VoucherTenderWriter['release']>[0], 'context'>> = {}) =>
      manager.write(options(), (context) =>
        writer.release({
          context,
          ...base,
          hold,
          reason: '取消预占',
          ...change,
        })
      ),
    consume: (hold: string, change: Partial<Omit<Parameters<VoucherRedemptionWriter['redeem']>[0], 'context'>> = {}) =>
      manager.write(options(), (context) =>
        redeemer.redeem({
          context,
          ...base,
          voucher: 'voucher:one',
          hold,
          verification: 'verify:one',
          order: 'order:one',
          amountMinor: 400,
          idempotency: 'redeem:one',
          ...change,
        })
      ),
    checkout: () => manager.write(options(), (context) => port.reserve(context, 'order:one', 'member:one', 'scope:test', [{ reference: 'voucher:one', amountMinor: 400 }])),
    paymentConsume: (scope?: string) => manager.write(options(scope), (context) => port.consume(context, 'order:one', 'member:one', 'voucher:one', 400)),
    paymentRelease: (scope?: string) => manager.write(options(scope), (context) => port.release(context, 'order:one')),
    paymentRefund: (change: Partial<Parameters<VoucherPort['refund']>[1]> = {}, scope?: string) =>
      manager.write({ ...options(scope), operation: 'payment.refunds.request' }, (context) => port.refund(context, { refund: 'refund:one', order: 'order:one', member: 'member:one', voucher: 'voucher:one', amountMinor: 400, ...change })),
    rebind: () =>
      manager.write({ ...options(), operation: 'voucher.vouchers.unbind' }, async () =>
        database.exec(`
      update voucher.holder set state='released',released_at=now(),version=version+1 where id='voucher:one:holder';
      update voucher.voucher set holder_id=null,state='available',version=version+1 where id='voucher:one';
      insert into voucher.holder values('holder:other','scope:test','voucher:one','member:other','bound',1,now(),null);
      update voucher.voucher set holder_id='holder:other',state='bound',version=version+1 where id='voucher:one';`)
      ),
    verify: (change: Partial<Parameters<VoucherPort['redeemVerification']>[1]> = {}) =>
      manager.write(options('store:one'), (context) => port.redeemVerification(context, { voucher: 'voucher:one', verification: 'verification:one', scope: 'scope:test', store: 'store:one', actor: 'principal:one', ...change })),
    apiRelease: (hold: string) => manager.write(options(), (context) => repository.release({ context: { transaction: context }, ...base, expectedVersion: 1, input: { path: { holdid: hold }, body: { reason: '取消预占' } } } as never)),
    holds: async () => (await database.query<{ id: string; state: string }>(`select id,owner_id,amount_minor::integer,state,version::integer from voucher.tenderhold order by id`)).rows,
    events: async () => (await database.query<{ id: string; event_type: string; payload: Record<string, unknown> }>(`select * from runtime.outbox order by id`)).rows,
    states: async () => (await database.query<{ id: string; state: string; remaining_minor: number; version: number }>(`select id,state,remaining_minor::integer,version::integer from voucher.voucher order by id`)).rows,
    history: async () => (await database.query(`select previous_state,next_state from voucher.timeline order by sequence`)).rows,
  };
}
