import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { OperationDatabase } from '../../../../foundation/application/ModuleOperations';
import type { OperationRequest, OperationResult } from '../../../../foundation/application/OperationHandler';
import type { FinanceRepositoryFactory } from '../port/FinanceRepository';
import { closeSettlementOperations } from './CloseSettlement';

describe('CloseSettlement authoritative snapshots', () => {
  let database: PGlite;

  beforeEach(async () => {
    database = new PGlite({ extensions: { pgcrypto } });
    await database.exec('create extension if not exists pgcrypto');
    await database.exec(schema);
    await database.exec(fixture);
  });

  afterEach(async () => database.close());

  it('seals a versioned full snapshot after approving an adjustment without mutating an existing line', async () => {
    await approveAdjustment(database);
    const result = await database.query<{
      version: number;
      gross: number;
      net: number;
      fee: number;
      snapshot_hash: string;
      line_count: number;
      split_count: number;
      adjustment_count: number;
      excluded_late_count: number;
    }>(`select version::float8 version,gross_minor::float8 gross,amount_minor::float8 net,fee_minor::float8 fee,
      evidence->'activeSnapshot'->>'hash' snapshot_hash,
      jsonb_array_length(evidence->'authoritativeSnapshots'->'1'->'lines') line_count,
      jsonb_array_length(evidence->'authoritativeSnapshots'->'1'->'splits') split_count,
      jsonb_array_length(evidence->'authoritativeSnapshots'->'1'->'adjustments') adjustment_count,
      (evidence->'authoritativeSnapshots'->'1'->'source'->>'excludedLateCount')::integer excluded_late_count
      from finance.settlement where id='settlement:one'`);
    expect(result.rows[0]).toEqual({
      version: 1,
      gross: 900,
      net: 810,
      fee: 90,
      snapshot_hash: expect.stringMatching(/^[0-9a-f]{64}$/),
      line_count: 2,
      split_count: 2,
      adjustment_count: 1,
      excluded_late_count: 2,
    });
    await expect(database.exec(`update finance.settlementline set amount_minor=999 where id='line:base'`)).rejects.toThrow('FINANCE_SETTLEMENT_LINE_IMMUTABLE');
  });

  it('fails final approval when the active rule changed after the adjustment snapshot', async () => {
    await approveAdjustment(database);
    await database.exec(`update finance.policy set version=4,rule='{"basisPoints":2000,"invoiceBasis":"net"}' where id='policy:settlement'`);
    await expect(approveSettlement(database)).rejects.toThrow(/FINANCE_SETTLEMENT_(CALCULATION|SNAPSHOT)_STALE/);
    await expect(postedCount(database)).resolves.toBe(0);
  });

  it('fails final approval when the reconciliation source or frozen line snapshot is stale', async () => {
    await approveAdjustment(database);
    await database.exec(`update finance.reconciliation set statement_hash=repeat('f',64) where id='reconciliation:one'`);
    await expect(approveSettlement(database)).rejects.toThrow(/FINANCE_SETTLEMENT_(SOURCE|SNAPSHOT)_STALE/);
    await database.exec(`update finance.reconciliation set statement_hash=repeat('a',64) where id='reconciliation:one';
      update finance.reconciliationitem set internal_minor=501 where id='item:late-refunded'`);
    await expect(approveSettlement(database)).rejects.toThrow('FINANCE_SETTLEMENT_SOURCE_STALE');
    await database.exec(`update finance.reconciliationitem set internal_minor=500 where id='item:late-refunded';
      alter table finance.settlementline disable trigger finance_settlementline_immutable;
      update finance.settlementline set amount_minor=999 where id='line:base';
      alter table finance.settlementline enable trigger finance_settlementline_immutable`);
    await expect(approveSettlement(database)).rejects.toThrow(/FINANCE_SETTLEMENT_(CALCULATION|SNAPSHOT)_STALE/);
    await database.exec(`alter table finance.settlementline disable trigger finance_settlementline_immutable;
      update finance.settlementline set amount_minor=1000 where id='line:base';
      alter table finance.settlementline enable trigger finance_settlementline_immutable;
      update finance.settlement set evidence=jsonb_set(evidence,'{authoritativeSnapshots,1,lines,0,amountMinor}','"999"')
      where id='settlement:one'`);
    await expect(approveSettlement(database)).rejects.toThrow('FINANCE_SETTLEMENT_SNAPSHOT_STALE');
    await expect(postedCount(database)).resolves.toBe(0);
  });

  it('never snapshots a late-payment diagnostic as a settleable line', async () => {
    await database.exec(`alter table finance.settlementline disable trigger finance_settlementline_immutable;
      update finance.settlementline set source_type='payment.late.detected' where id='line:base';
      alter table finance.settlementline enable trigger finance_settlementline_immutable`);
    await expect(approveAdjustment(database)).rejects.toThrow('FINANCE_SETTLEMENT_SOURCE_NOT_SETTLEABLE');
    const adjustment = await database.query<{ state: string }>(`select state from finance.settlementadjustment where id='adjustment:one'`);
    expect(adjustment.rows[0]).toEqual({ state: 'pending' });
  });

  it('posts and marks payable only when the locked rule, source, lines, splits and adjustments match the latest snapshot', async () => {
    await approveAdjustment(database);
    await approveSettlement(database);
    const settlement = await database.query<{ state: string; version: number; approved_by: string }>(`select state,version::float8 version,approved_by from finance.settlement where id='settlement:one'`);
    expect(settlement.rows[0]).toEqual({ state: 'payable', version: 2, approved_by: 'finance:final' });
    const posts = await database.query<{ reference_id: string; amount: number; occurred_at: string }>(`select reference_id,
      amount_minor::float8 amount,occurred_at::text occurred_at from finance.posted order by reference_id`);
    expect(posts.rows).toEqual([
      { reference_id: 'settlement:one:partner', amount: 810, occurred_at: '2026-08-31 23:59:59.999999+08' },
      { reference_id: 'settlement:one:platform', amount: 90, occurred_at: '2026-08-31 23:59:59.999999+08' },
    ]);
  });
});

async function approveAdjustment(database: PGlite): Promise<OperationResult> {
  return invoke(
    database,
    'finance.settlements.adjust',
    'finance:adjuster',
    1,
    {
      action: 'approve',
      adjustment: 'adjustment:one',
      reason: 'verified adjustment',
      evidence: { ticket: 'FIN-1' },
    },
    0
  );
}

async function approveSettlement(database: PGlite): Promise<OperationResult> {
  return invoke(
    database,
    'finance.settlements.decide',
    'finance:final',
    3,
    {
      decision: 'approved',
      reason: 'verified settlement',
      evidence: { ticket: 'FIN-2' },
    },
    1
  );
}

async function invoke(database: PGlite, operation: 'finance.settlements.adjust' | 'finance.settlements.decide', actor: string, assurance: number, body: Readonly<Record<string, unknown>>, expectedVersion: number): Promise<OperationResult> {
  const query = (text: string, values?: readonly unknown[]) => database.query(text, values === undefined ? undefined : [...values]);
  const adapter = { query } as OperationDatabase;
  const action = closeSettlementOperations(repository)[operation];
  if (typeof action !== 'function') throw new Error('TEST_OPERATION_MISSING');
  const request: OperationRequest = {
    type: operation,
    access: {
      actor: {
        id: actor,
        session: `session:${actor}`,
        membership: 'membership:finance',
        credentialVersion: 1,
        accessVersion: 1,
        target: 'console',
        assurance: { level: assurance, verified: new Date() },
      },
      membership: { id: 'membership:finance', active: true, accessVersion: 1, grants: [], denies: [] },
      scope: { kind: 'mall', id: 'scope:finance', path: [] },
      accessVersion: 1,
      capabilities: [operation],
      assurance: { level: assurance, verified: new Date() },
      trace: 'trace:settlement',
    },
    input: {
      path: { settlementid: 'settlement:one' },
      query: {},
      headers: {},
      body,
      rawBody: JSON.stringify(body),
      deadline: Date.now() + 5_000,
      signal: new AbortController().signal,
      idempotency: `test:${operation}:${actor}`,
      expectedVersion,
    },
  };
  await database.exec('begin');
  try {
    const result = await action(request, adapter);
    await database.exec('commit');
    return result;
  } catch (cause) {
    await database.exec('rollback');
    throw cause;
  }
}

async function postedCount(database: PGlite): Promise<number> {
  const result = await database.query<{ count: number }>('select count(*)::integer count from finance.posted');
  return result.rows[0]!.count;
}

const repository: FinanceRepositoryFactory = () => ({
  enqueue: async () => undefined,
  event: async () => undefined,
});

const schema = `
  create schema finance;
  create schema channel;
  create table channel.statement(
    id text primary key,provider text not null,scope_id text not null,partner_id text not null,
    period_end date not null,timezone text not null,sha256 char(64) not null
  );
  create table finance.reconciliation(
    id text primary key,scope_id text not null,provider text not null,partner_id text not null,
    statement_ref text not null references channel.statement(id),statement_hash char(64) not null,credit_minor bigint not null
  );
  create table finance.policy(
    id text primary key,scope_id text not null,kind text not null,state text not null,version bigint not null,rule jsonb not null
  );
  create table finance.reconciliationitem(
    id text primary key,reconciliation_id text not null references finance.reconciliation(id),kind text not null,
    internal_type text,internal_id text,internal_minor bigint not null,state text not null,reason_code text,evidence jsonb not null
  );
  create table finance.settlement(
    id text primary key,scope_id text not null,partner_id text not null,reconciliation_id text not null references finance.reconciliation(id),
    currency char(3) not null,gross_minor bigint not null,fee_minor bigint not null,amount_minor bigint not null,
    invoice_basis text not null,state text not null,requested_by text not null,approved_by text,approved_at timestamptz,
    evidence jsonb not null,version bigint not null
  );
  create table finance.settlementline(
    id text primary key,settlement_id text not null references finance.settlement(id),
    reconciliation_item_id text not null references finance.reconciliationitem(id),scope_id text not null,source_type text not null,
    source_id text not null,amount_minor bigint not null,invoice_minor bigint not null,tax_minor bigint not null,
    direction text not null,state text not null,adjustment_of text references finance.settlementline(id),created_at timestamptz not null,
    unique(settlement_id,reconciliation_item_id,adjustment_of)
  );
  create table finance.settlementadjustment(
    id text primary key,settlement_id text not null references finance.settlement(id),
    settlement_line_id text not null references finance.settlementline(id),scope_id text not null,direction text not null,
    amount_minor bigint not null,tax_minor bigint not null,state text not null,requested_by text not null,approved_by text,
    reason text not null,evidence jsonb not null,created_at timestamptz not null,decided_at timestamptz,version bigint not null
  );
  create table finance.split(
    id text primary key,settlement_id text not null references finance.settlement(id),scope_id text not null,
    beneficiary_type text not null,beneficiary_id text not null,amount_minor bigint not null,basis_points integer not null,
    state text not null,created_at timestamptz not null,unique(settlement_id,beneficiary_type,beneficiary_id)
  );
  create function finance.apply_settlement_adjustment_facts(p_adjustment text) returns text language plpgsql as $function$
  declare target record; points integer; invoice_minor bigint; prior_gross bigint; prior_fee bigint; prior_net bigint;
  begin
    select adjustment.id adjustment_id,adjustment.settlement_id,adjustment.settlement_line_id,
      adjustment.scope_id,adjustment.direction,adjustment.amount_minor adjustment_minor,
      adjustment.tax_minor adjustment_tax_minor,settlement.partner_id,settlement.gross_minor,
      settlement.fee_minor,settlement.amount_minor net_minor,settlement.invoice_basis,line.reconciliation_item_id,
      policy.rule into target
    from finance.settlementadjustment adjustment join finance.settlement settlement on settlement.id=adjustment.settlement_id
    join finance.settlementline line on line.id=adjustment.settlement_line_id
    join finance.policy policy on policy.scope_id=settlement.scope_id and policy.kind='settlement' and policy.state='active'
    where adjustment.id=p_adjustment and adjustment.state='approved' and settlement.state='draft';
    points:=(target.rule->>'basisPoints')::integer;
    prior_gross:=target.gross_minor-case target.direction when 'increase' then target.adjustment_minor else -target.adjustment_minor end;
    prior_fee:=floor(prior_gross::numeric*points/10000)::bigint;
    prior_net:=prior_gross-prior_fee;
    invoice_minor:=case target.invoice_basis when 'gross' then target.adjustment_minor else abs(target.net_minor-prior_net) end;
    insert into finance.settlementline(id,settlement_id,reconciliation_item_id,scope_id,source_type,source_id,
      amount_minor,invoice_minor,tax_minor,direction,state,adjustment_of,created_at)
    values('settlementline:'||target.adjustment_id,target.settlement_id,target.reconciliation_item_id,target.scope_id,
      'adjustment',target.adjustment_id,target.adjustment_minor,invoice_minor,target.adjustment_tax_minor,
      target.direction,'frozen',target.settlement_line_id,clock_timestamp()) on conflict(id) do nothing;
    update finance.split set amount_minor=target.net_minor,basis_points=10000-points
    where settlement_id=target.settlement_id and beneficiary_type='partner' and state='frozen';
    insert into finance.split(id,settlement_id,scope_id,beneficiary_type,beneficiary_id,amount_minor,basis_points,state,created_at)
    values('split:'||target.settlement_id||':platform',target.settlement_id,target.scope_id,'platform','platform',
      target.fee_minor,points,'frozen',clock_timestamp()) on conflict(settlement_id,beneficiary_type,beneficiary_id)
    do update set amount_minor=excluded.amount_minor,basis_points=excluded.basis_points where finance.split.state='frozen';
    return 'settlementline:'||target.adjustment_id;
  end $function$;
  create function finance.mark_platform_settlement_split_paid(p_settlement text) returns boolean language plpgsql as $function$
  begin update finance.split set state='paid' where settlement_id=p_settlement and beneficiary_type='platform' and state='frozen'; return true; end $function$;
  create table finance.posted(reference_id text primary key,amount_minor bigint not null,occurred_at timestamptz not null);
  create function finance.post(text,text,text,text,text,text,text,text,text,bigint,timestamptz)
  returns text language plpgsql as $function$ begin
    insert into finance.posted(reference_id,amount_minor,occurred_at) values($3,$10,$11);
    return 'journal:'||$3;
  end $function$;
  create function finance.reject_settlementline_mutation() returns trigger language plpgsql as $function$
    begin raise exception 'FINANCE_SETTLEMENT_LINE_IMMUTABLE'; end $function$;
  create trigger finance_settlementline_immutable before update or delete on finance.settlementline
    for each row execute function finance.reject_settlementline_mutation();
`;

const fixture = `
  insert into channel.statement(id,provider,scope_id,partner_id,period_end,timezone,sha256)
  values('statement:one','wechat','scope:finance','partner:one','2026-08-31','Asia/Shanghai',repeat('a',64));
  insert into finance.reconciliation(id,scope_id,provider,partner_id,statement_ref,statement_hash,credit_minor)
  values('reconciliation:one','scope:finance','wechat','partner:one','statement:one',repeat('a',64),1000);
  insert into finance.policy(id,scope_id,kind,state,version,rule)
  values('policy:settlement','scope:finance','settlement','active',3,'{"basisPoints":1000,"invoiceBasis":"net"}');
  insert into finance.reconciliationitem(id,reconciliation_id,kind,internal_type,internal_id,internal_minor,state,reason_code,evidence) values
    ('item:base','reconciliation:one','payment','payment','payment:one',1000,'matched',null,
      '{"journalReferenceType":"payment.succeeded","settlementEligible":true}'),
    ('item:late-detected','reconciliation:one','late_detected','payment','payment:late-a',1000,'matched',null,
      '{"journalReferenceType":"payment.late.detected","settlementEligible":false}'),
    ('item:late-refunded','reconciliation:one','late_refunded','payment','payment:late-b',500,'matched',null,
      '{"journalReferenceType":"payment.late.refunded","settlementEligible":false}');
  insert into finance.settlement(id,scope_id,partner_id,reconciliation_id,currency,gross_minor,fee_minor,amount_minor,
    invoice_basis,state,requested_by,evidence,version)
  values('settlement:one','scope:finance','partner:one','reconciliation:one','CNY',1000,100,900,'net','draft',
    'finance:requester','{}',0);
  insert into finance.settlementline(id,settlement_id,reconciliation_item_id,scope_id,source_type,source_id,amount_minor,
    invoice_minor,tax_minor,direction,state,created_at)
  values('line:base','settlement:one','item:base','scope:finance','payment.succeeded','payment:one',1000,900,0,'increase','frozen',clock_timestamp());
  insert into finance.split(id,settlement_id,scope_id,beneficiary_type,beneficiary_id,amount_minor,basis_points,state,created_at) values
    ('split:partner','settlement:one','scope:finance','partner','partner:one',900,9000,'frozen',clock_timestamp()),
    ('split:platform','settlement:one','scope:finance','platform','platform',100,1000,'frozen',clock_timestamp());
  insert into finance.settlementadjustment(id,settlement_id,settlement_line_id,scope_id,direction,amount_minor,tax_minor,state,
    requested_by,reason,evidence,created_at,version)
  values('adjustment:one','settlement:one','line:base','scope:finance','decrease',100,0,'pending','finance:adjustment-requester',
    'requested','{}',clock_timestamp(),0);
  update finance.settlement settlement set evidence=jsonb_build_object(
    'reconciliation',settlement.reconciliation_id,
    'statementHash',reconciliation.statement_hash,
    'recognition',jsonb_build_object(
      'occurredAt',(((statement.period_end+1)::timestamp at time zone statement.timezone)-interval '1 microsecond')::text,
      'timezone',statement.timezone,'statementPeriodEnd',statement.period_end::text
    ),
    'payableBasis',jsonb_build_object(
      'itemCount',1,
      'itemHash',encode(public.digest('item:base:payment:payment:payment:one:1000:matched','sha256'),'hex'),
      'grossMinor',1000
    ),
    'excludedLateBasis',jsonb_build_object(
      'itemCount',2,
      'itemHash',encode(public.digest(
        'item:late-detected:late_detected:payment:payment:late-a:1000:matched,item:late-refunded:late_refunded:payment:payment:late-b:500:matched',
        'sha256'),'hex')
    ),
    'settlementRule',jsonb_build_object(
      'id',policy.id,'version',policy.version,
      'hash',encode(public.digest(policy.id||':'||policy.version||':'||policy.rule::text,'sha256'),'hex'),'rule',policy.rule
    ),
    'calculation',jsonb_build_object(
      'grossMinor',1000,'feeMinor',100,'netMinor',900,'basisPoints',1000,'invoiceBasis','net'
    ),
    'lineSnapshot',jsonb_build_object(
      'count',1,'net',1000,'invoice',900,
      'hash',encode(public.digest('line:base:item:base:payment.succeeded:payment:one:1000:900:0:increase','sha256'),'hex')
    )
  )
  from finance.reconciliation reconciliation,finance.policy policy,channel.statement statement
  where settlement.id='settlement:one' and reconciliation.id=settlement.reconciliation_id
    and statement.id=reconciliation.statement_ref and policy.id='policy:settlement';
`;
