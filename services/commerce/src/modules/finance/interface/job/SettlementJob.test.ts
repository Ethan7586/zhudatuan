import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DatabasePool } from '../../../../foundation/persistence/Pool';
import type { PayoutGateway } from '../../application/port/PayoutGateway';
import { SettlementJobProcessor } from './SettlementJob';

describe('SettlementJobProcessor frozen basis', () => {
  let database: PGlite;

  beforeEach(async () => {
    database = new PGlite({ extensions: { pgcrypto } });
    await database.exec('create extension if not exists pgcrypto');
    await database.exec(schema);
    await database.exec(fixture);
  });

  afterEach(async () => {
    await database.close();
  });

  it('writes the net invoice allocation once, preserves refunds, and safely replays the frozen result', async () => {
    const processor = new SettlementJobProcessor(pool(database), {} as PayoutGateway);
    const job = { id: 'job:settlement:audit', kind: 'settlement', scope_id: 'scope:finance', attempts: 1, payload: { reconciliation: 'reconciliation:audit' } };
    await processor.process(job, new AbortController().signal);

    const settlement = await database.query<{
      gross: number;
      fee: number;
      net: number;
      basis: string;
      item_count: number;
      invoice: number;
      excluded_late: number;
      recognition: string;
      timezone: string;
      period_end: string;
    }>(`select gross_minor::float8 gross,fee_minor::float8 fee,amount_minor::float8 net,
      invoice_basis basis,(evidence->'lineSnapshot'->>'count')::integer item_count,
      (evidence->'lineSnapshot'->>'invoice')::float8 invoice,
      (evidence->'excludedLateBasis'->>'itemCount')::integer excluded_late,
      evidence->'recognition'->>'occurredAt' recognition,evidence->'recognition'->>'timezone' timezone,
      evidence->'recognition'->>'statementPeriodEnd' period_end from finance.settlement`);
    expect(settlement.rows[0]).toEqual({
      gross: 800,
      fee: 80,
      net: 720,
      basis: 'net',
      item_count: 2,
      invoice: 720,
      excluded_late: 2,
      recognition: '2026-08-31 23:59:59.999999+08',
      timezone: 'Asia/Shanghai',
      period_end: '2026-08-31',
    });

    const lines = await database.query<{ source: string; amount: number; invoice: number; direction: string }>(`select
      source_id source,amount_minor::float8 amount,invoice_minor::float8 invoice,direction
      from finance.settlementline order by source_id`);
    expect(lines.rows).toEqual([
      { source: 'payment:audit', amount: 1_000, invoice: 720, direction: 'increase' },
      { source: 'refund:audit', amount: 200, invoice: 0, direction: 'decrease' },
    ]);

    await expect(database.exec("update finance.settlementline set invoice_minor=721 where source_id='payment:audit'")).rejects.toThrow('FINANCE_SETTLEMENT_LINE_IMMUTABLE');
    await processor.process(job, new AbortController().signal);
    const replay = await database.query<{ settlements: number; lines: number }>(`select
      (select count(*)::integer from finance.settlement) settlements,
      (select count(*)::integer from finance.settlementline) lines`);
    expect(replay.rows[0]).toEqual({ settlements: 1, lines: 2 });
  });
});

function pool(database: PGlite): DatabasePool {
  const query = (text: string, values?: readonly unknown[]) => database.query(text, values === undefined ? undefined : [...values]);
  const adapter = { query, connect: async () => ({ query, release: () => undefined }), workload: () => adapter, end: async () => database.close() };
  return adapter as unknown as DatabasePool;
}

const schema = `
  create schema finance;
  create schema channel;
  create table channel.statement(
    id text primary key,provider text not null,scope_id text not null,partner_id text not null,
    period_end date not null,timezone text not null,sha256 char(64) not null
  );
  create table finance.reconciliation(
    id text primary key,scope_id text not null,provider text not null,partner_id text not null,period text not null,
    statement_ref text not null references channel.statement(id),state text not null,difference_minor bigint not null,
    credit_minor bigint not null,created_by text not null,statement_hash char(64) not null
  );
  create table finance.policy(
    id text primary key,scope_id text not null,kind text not null,state text not null,version bigint not null,rule jsonb not null
  );
  create table finance.statementline(
    id text primary key,kind text not null,external_reference text not null,tax_minor bigint not null
  );
  create table finance.reconciliationitem(
    id text primary key,reconciliation_id text not null references finance.reconciliation(id),
    statement_line_id text references finance.statementline(id),kind text not null,internal_type text,internal_id text,internal_minor bigint not null,
    state text not null,reason_code text,evidence jsonb not null
  );
  create table finance.settlement(
    id text primary key,partner_id text not null,period text not null,reconciliation_id text not null references finance.reconciliation(id),
    amount_minor bigint not null,currency char(3) not null,state text not null,scope_id text not null,requested_by text not null,
    frozen_at timestamptz not null,evidence jsonb not null,version bigint not null,gross_minor bigint not null,fee_minor bigint not null,
    invoice_basis text not null,unique(partner_id,period)
  );
  create table finance.settlementline(
    id text primary key,settlement_id text not null references finance.settlement(id),
    reconciliation_item_id text not null references finance.reconciliationitem(id),scope_id text not null,source_type text not null,
    source_id text not null,amount_minor bigint not null,invoice_minor bigint not null,tax_minor bigint not null,direction text not null,
    state text not null,created_at timestamptz not null
  );
  create table finance.split(
    id text primary key,settlement_id text not null references finance.settlement(id),scope_id text not null,
    beneficiary_type text not null,beneficiary_id text not null,amount_minor bigint not null,basis_points integer not null,
    state text not null,created_at timestamptz not null,unique(settlement_id,beneficiary_type,beneficiary_id)
  );
  create function finance.freeze_settlement_facts(p_settlement text) returns bigint language plpgsql as $function$
  declare target record; invoice_target bigint; result bigint;
  begin
    select * into target from finance.settlement where id=p_settlement and state='draft';
    invoice_target:=case target.invoice_basis when 'net' then target.amount_minor else target.gross_minor end;
    with source as(
      select item.id item_id,item.evidence->>'journalReferenceType' source_type,
        coalesce(item.internal_id,line.external_reference) source_id,item.internal_minor amount_minor,line.tax_minor,
        case when line.kind='refund' then 'decrease' else 'increase' end direction
      from finance.reconciliationitem item join finance.statementline line on line.id=item.statement_line_id
      where item.reconciliation_id=target.reconciliation_id and item.state='matched' and item.reason_code is null
        and item.internal_minor>0 and item.evidence->>'journalReferenceType' in('payment.succeeded','payment.refunded')
        and coalesce((item.evidence->>'settlementEligible')::boolean,false)
    ), positive as(
      select source.*,row_number() over(order by item_id) sequence,count(*) over() item_count,
        floor(amount_minor::numeric*invoice_target/sum(amount_minor) over()) base_invoice
      from source where direction='increase'
    ), allocated as(
      select positive.*,case when sequence=item_count then invoice_target-coalesce(sum(base_invoice) over(
        order by item_id rows between unbounded preceding and 1 preceding),0) else base_invoice end invoice_minor
      from positive
    )
    insert into finance.settlementline(id,settlement_id,reconciliation_item_id,scope_id,source_type,source_id,
      amount_minor,invoice_minor,tax_minor,direction,state,created_at)
    select 'settlementline:'||source.item_id,target.id,source.item_id,target.scope_id,source.source_type,source.source_id,
      source.amount_minor,coalesce(allocated.invoice_minor,0),source.tax_minor,source.direction,'frozen',clock_timestamp()
    from source left join allocated on allocated.item_id=source.item_id on conflict(id) do nothing;
    insert into finance.split(id,settlement_id,scope_id,beneficiary_type,beneficiary_id,amount_minor,basis_points,state,created_at)
    values('split:'||target.id||':partner',target.id,target.scope_id,'partner',target.partner_id,target.amount_minor,
      10000-(target.evidence#>>'{calculation,basisPoints}')::integer,'frozen',clock_timestamp()) on conflict(id) do nothing;
    if target.fee_minor>0 then
      insert into finance.split(id,settlement_id,scope_id,beneficiary_type,beneficiary_id,amount_minor,basis_points,state,created_at)
      values('split:'||target.id||':platform',target.id,target.scope_id,'platform','platform',target.fee_minor,
        (target.evidence#>>'{calculation,basisPoints}')::integer,'frozen',clock_timestamp()) on conflict(id) do nothing;
    end if;
    select count(*) into result from finance.settlementline where settlement_id=target.id;
    return result;
  end $function$;
  create function finance.reject_settlementline_mutation() returns trigger language plpgsql as $function$
    begin raise exception 'FINANCE_SETTLEMENT_LINE_IMMUTABLE'; end $function$;
  create trigger finance_settlementline_immutable before update or delete on finance.settlementline
    for each row execute function finance.reject_settlementline_mutation();
`;

const fixture = `
  insert into channel.statement(id,provider,scope_id,partner_id,period_end,timezone,sha256)
  values('statement:audit','wechat','scope:finance','partner:finance','2026-08-31','Asia/Shanghai',repeat('a',64));
  insert into finance.reconciliation(id,scope_id,provider,partner_id,period,statement_ref,state,difference_minor,credit_minor,
    created_by,statement_hash)
  values('reconciliation:audit','scope:finance','wechat','partner:finance','2026-08-01/2026-08-31','statement:audit',
    'approved',0,800,'finance:requester',repeat('a',64));
  insert into finance.policy(id,scope_id,kind,state,version,rule)
  values('policy:settlement:audit','scope:finance','settlement','active',3,'{"basisPoints":1000,"invoiceBasis":"net"}');
  insert into finance.statementline(id,kind,external_reference,tax_minor) values
    ('statementline:payment','payment','wechat:payment:audit',0),
    ('statementline:refund','refund','wechat:refund:audit',0),
    ('statementline:late-payment','payment','wechat:late-payment:audit',0),
    ('statementline:late-refund','refund','wechat:late-refund:audit',0);
  insert into finance.reconciliationitem(id,reconciliation_id,statement_line_id,kind,internal_type,internal_id,internal_minor,state,reason_code,evidence) values
    ('item:payment','reconciliation:audit','statementline:payment','payment','payment','payment:audit',1000,'matched',null,
      '{"journalReferenceType":"payment.succeeded","settlementEligible":true}'),
    ('item:refund','reconciliation:audit','statementline:refund','refund','refund','refund:audit',200,'matched',null,
      '{"journalReferenceType":"payment.refunded","settlementEligible":true}'),
    ('item:late-payment','reconciliation:audit','statementline:late-payment','payment','payment','payment:late',420,'matched',null,
      '{"journalReferenceType":"payment.late.detected","settlementEligible":false}'),
    ('item:late-refund','reconciliation:audit','statementline:late-refund','refund','refund','refund:late',420,'matched',null,
      '{"journalReferenceType":"payment.late.refunded","settlementEligible":false}');
`;
