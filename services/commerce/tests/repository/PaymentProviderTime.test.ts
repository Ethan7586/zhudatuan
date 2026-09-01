import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const migration = fileURLToPath(new URL('../../../../database/supabase/migrations/20260828095000_payment_provider_time_evidence.sql', import.meta.url));
const monthEnd = '2026-08-31T23:59:59.987654+08:00';

describe('payment provider accounting evidence PostgreSQL integrity', () => {
  let database: PGlite;

  beforeEach(async () => {
    database = new PGlite({ extensions: { pgcrypto } });
    await database.exec('create extension if not exists pgcrypto');
    await database.exec(baseSchema);
    await seedLegacy(database);
    await database.exec(await readFile(migration, 'utf8'));
  });

  afterEach(async () => {
    await database.close();
  });

  it('is additive and leaves historical completion times explicitly unverified', async () => {
    const legacy = await database.query<{
      attempts: number;
      captures: number;
      refunds: number;
      observations: number;
    }>(`select
      (select count(*)::integer from payment.attempt where id='attempt:legacy' and provider_effect_hash is null) attempts,
      (select count(*)::integer from payment.capture where id='capture:legacy' and provider_effect_hash is null) captures,
      (select count(*)::integer from payment.providerattempt where id='providerattempt:legacy' and provider_effect_hash is null) refunds,
      (select count(*)::integer from payment.observation where id='observation:legacy' and provider_effect_hash is null) observations`);

    expect(legacy.rows[0]).toEqual({ attempts: 1, captures: 1, refunds: 1, observations: 1 });
  });

  it('seals month-end capture, refund and observation facts with database-verifiable hashes', async () => {
    const payment = paymentEffect();
    const refund = refundEffect();
    const observation = observationEffect();
    await database.query(
      `update payment.attempt set state='succeeded',external_transaction='transaction:one',completed_at=$1,
        provider_occurred_at=$1,provider_effect=$2,provider_effect_hash=encode(public.digest($2::jsonb::text,'sha256'),'hex')
      where id='attempt:new'`,
      [monthEnd, payment]
    );
    await database.query(
      `update payment.capture set completed_at=$1,provider_occurred_at=$1,provider_effect=$2,
        provider_effect_hash=encode(public.digest($2::jsonb::text,'sha256'),'hex') where id='capture:new'`,
      [monthEnd, payment]
    );
    await database.query(
      `update payment.providerattempt set outcome='succeeded',provider_state='succeeded',provider_reference='refund-reference:one',
        completed_at=$1,provider_occurred_at=$1,provider_effect=$2,
        provider_effect_hash=encode(public.digest($2::jsonb::text,'sha256'),'hex') where id='providerattempt:new'`,
      [monthEnd, refund]
    );
    await database.query(
      `update payment.observation set provider_occurred_at=$1,provider_effect=$2,
        provider_effect_hash=encode(public.digest($2::jsonb::text,'sha256'),'hex') where id='observation:new'`,
      [monthEnd, observation]
    );

    const sealed = await database.query<{ count: number }>(`select count(*)::integer count from (
      select provider_effect,provider_effect_hash from payment.attempt where id='attempt:new'
      union all select provider_effect,provider_effect_hash from payment.capture where id='capture:new'
      union all select provider_effect,provider_effect_hash from payment.providerattempt where id='providerattempt:new'
      union all select provider_effect,provider_effect_hash from payment.observation where id='observation:new'
    ) facts where provider_effect_hash=encode(public.digest(provider_effect::text,'sha256'),'hex')`);
    expect(sealed.rows[0]?.count).toBe(4);
  });

  it('accepts an exact replay but rejects mutation or deletion of a sealed fact', async () => {
    const payment = paymentEffect();
    await database.query(
      `update payment.capture set completed_at=$1,provider_occurred_at=$1,provider_effect=$2,
        provider_effect_hash=encode(public.digest($2::jsonb::text,'sha256'),'hex') where id='capture:new'`,
      [monthEnd, payment]
    );

    await expect(
      database.query(
        `update payment.capture set completed_at=$1,provider_occurred_at=$1,provider_effect=$2,
          provider_effect_hash=encode(public.digest($2::jsonb::text,'sha256'),'hex') where id='capture:new'`,
        [monthEnd, payment]
      )
    ).resolves.toBeDefined();
    await expect(database.exec("update payment.capture set amount_minor=999 where id='capture:new'")).rejects.toThrow();
    await expect(database.exec("update payment.capture set provider_effect=jsonb_set(provider_effect,'{occurredAt}','\"2026-09-01T00:00:00+08:00\"') where id='capture:new'")).rejects.toThrow('PAYMENT_PROVIDER_EFFECT_IMMUTABLE');
    await expect(database.exec("delete from payment.capture where id='capture:new'")).rejects.toThrow('PAYMENT_PROVIDER_EFFECT_IMMUTABLE');
  });

  it('rejects partial, mismatched and invalid provider facts', async () => {
    await expect(database.exec(`update payment.attempt set completed_at='${monthEnd}',provider_occurred_at='${monthEnd}' where id='attempt:new'`)).rejects.toThrow();
    await expect(
      database.query(
        `update payment.capture set completed_at=$1,provider_occurred_at=$1,provider_effect=$2,
          provider_effect_hash=encode(public.digest($2::jsonb::text,'sha256'),'hex') where id='capture:new'`,
        [monthEnd, { ...paymentEffect(), aggregateAmountMinor: 999 }]
      )
    ).rejects.toThrow();
    await expect(
      database.query(
        `update payment.providerattempt set outcome='succeeded',provider_state='succeeded',provider_reference='refund-reference:one',
          completed_at=$1,provider_occurred_at=$1,provider_effect=$2,
          provider_effect_hash=encode(public.digest($2::jsonb::text,'sha256'),'hex') where id='providerattempt:new'`,
        [monthEnd, { ...refundEffect(), occurredAt: 'not-a-provider-time' }]
      )
    ).rejects.toThrow();
  });
});

function paymentEffect() {
  return {
    version: 1,
    provider: 'wechat',
    kind: 'payment.capture',
    intent: 'intent:one',
    order: 'order:one',
    transaction: 'transaction:one',
    providerAmountMinor: 400,
    aggregateAmountMinor: 1000,
    currency: 'CNY',
    occurredAt: monthEnd,
  };
}

function refundEffect() {
  return {
    version: 1,
    provider: 'wechat',
    kind: 'payment.refund',
    refund: 'refund:one',
    payment: 'payment:one',
    reference: 'refund-reference:one',
    amountMinor: 400,
    totalMinor: 400,
    currency: 'CNY',
    occurredAt: monthEnd,
  };
}

function observationEffect() {
  return {
    version: 1,
    provider: 'wechat',
    kind: 'payment.observation',
    occurredAt: monthEnd,
    amountMinor: 400,
    currency: 'CNY',
  };
}

async function seedLegacy(database: PGlite): Promise<void> {
  await database.exec(`insert into payment.attempt(id,provider,state,requested_at,completed_at)
      values('attempt:legacy','wechat','failed',clock_timestamp(),clock_timestamp()),
        ('attempt:new','wechat','started',clock_timestamp(),null);
    insert into payment.capture(id,order_id,amount_minor,currency,state,completed_at)
      values('capture:legacy','order:legacy',100,'CNY','succeeded',clock_timestamp()),
        ('capture:new','order:one',1000,'CNY','succeeded',clock_timestamp());
    insert into payment.providerattempt(id,refund_id,outcome,started_at,completed_at)
      values('providerattempt:legacy','refund:legacy','failed',clock_timestamp(),clock_timestamp()),
        ('providerattempt:new','refund:one','started',clock_timestamp(),null);
    insert into payment.observation(id,amount_minor,currency,observed_at)
      values('observation:legacy',100,'CNY',clock_timestamp()),
        ('observation:new',400,'CNY',clock_timestamp());`);
}

const baseSchema = `
  create schema runtime;
  create schema payment;
  create table runtime.schemaversion(version text primary key,checksum text not null);
  create table payment.attempt(
    id text primary key,
    provider text not null,
    external_transaction text,
    state text not null,
    requested_at timestamptz not null,
    completed_at timestamptz
  );
  create table payment.capture(
    id text primary key,
    order_id text not null,
    amount_minor bigint not null,
    currency char(3) not null,
    state text not null,
    completed_at timestamptz not null
  );
  create table payment.providerattempt(
    id text primary key,
    refund_id text not null,
    outcome text not null,
    provider_state text,
    provider_reference text,
    started_at timestamptz not null,
    completed_at timestamptz
  );
  create table payment.observation(
    id text primary key,
    amount_minor bigint not null,
    currency char(3) not null,
    observed_at timestamptz not null
  );
`;
