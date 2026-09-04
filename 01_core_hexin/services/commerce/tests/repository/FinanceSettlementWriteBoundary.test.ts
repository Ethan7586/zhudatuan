import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const migrations = fileURLToPath(new URL('../../../../../02_platform_pingtai/database/supabase/migrations', import.meta.url));
const actor = 'member-fresh-replay-ethan';
const scope = 'scope:settlement-write-boundary';
const settlement = 'settlement:write-boundary';
const adjustment = 'adjustment:write-boundary';

describe('finance settlement fact PostgreSQL write boundary', () => {
  let database: PGlite;

  beforeAll(async () => {
    database = new PGlite({ extensions: { pgcrypto } });
    await replayThroughAccountingIntegrity(database);
    await seedSettlement(database);
  }, 30_000);

  afterAll(async () => database.close());

  it('separates app/job functions, rejects direct writes and derives tamper-evident replayable facts', async () => {
    const privileges = await database.query<Record<string, boolean>>(`select
      has_table_privilege('shopapp','finance.journal','INSERT') app_journal_insert,
      has_table_privilege('shopjob','finance.journal','INSERT') job_journal_insert,
      has_table_privilege('shopapp','finance.entry','INSERT') app_entry_insert,
      has_table_privilege('shopjob','finance.entry','INSERT') job_entry_insert,
      has_table_privilege('shopapp','finance.ledger','INSERT') app_ledger_insert,
      has_table_privilege('shopjob','finance.ledger','INSERT') job_ledger_insert,
      has_table_privilege('shopapp','finance.subledger','INSERT') app_subledger_insert,
      has_table_privilege('shopjob','finance.subledger','INSERT') job_subledger_insert,
      has_table_privilege('shopapp','finance.subledgerentry','INSERT') app_subledger_entry_insert,
      has_table_privilege('shopjob','finance.subledgerentry','INSERT') job_subledger_entry_insert,
      has_table_privilege('shopapp','finance.settlementline','INSERT') app_line_insert,
      has_table_privilege('shopapp','finance.settlementline','UPDATE') app_line_update,
      has_table_privilege('shopjob','finance.settlementline','INSERT') job_line_insert,
      has_table_privilege('shopjob','finance.settlementline','UPDATE') job_line_update,
      has_table_privilege('shopapp','finance.split','INSERT') app_split_insert,
      has_table_privilege('shopapp','finance.split','UPDATE') app_split_update,
      has_table_privilege('shopjob','finance.split','INSERT') job_split_insert,
      has_table_privilege('shopjob','finance.split','UPDATE') job_split_update,
      has_table_privilege('shopapp','finance.settlementadjustment','INSERT') app_adjustment_insert,
      has_table_privilege('shopapp','finance.settlementadjustment','UPDATE') app_adjustment_update,
      has_table_privilege('shopjob','finance.settlementadjustment','INSERT') job_adjustment_insert,
      has_table_privilege('shopjob','finance.settlementadjustment','UPDATE') job_adjustment_update,
      has_table_privilege('shopapp','finance.withdrawal','INSERT') app_withdrawal_insert,
      has_table_privilege('shopapp','finance.withdrawal','UPDATE') app_withdrawal_update,
      has_table_privilege('shopjob','finance.withdrawal','INSERT') job_withdrawal_insert,
      has_table_privilege('shopjob','finance.withdrawal','UPDATE') job_withdrawal_update,
      has_table_privilege('service_role','finance.journal','INSERT,UPDATE,DELETE')
        or has_table_privilege('service_role','finance.entry','INSERT,UPDATE,DELETE')
        or has_table_privilege('service_role','finance.subledger','INSERT,UPDATE,DELETE')
        or has_table_privilege('service_role','finance.subledgerentry','INSERT,UPDATE,DELETE')
        or has_table_privilege('service_role','finance.settlementline','INSERT,UPDATE,DELETE')
        or has_table_privilege('service_role','finance.settlementadjustment','INSERT,UPDATE,DELETE')
        or has_table_privilege('service_role','finance.split','INSERT,UPDATE,DELETE')
        or has_table_privilege('service_role','finance.withdrawal','INSERT,UPDATE,DELETE') service_any_write,
      has_function_privilege('shopjob','finance.freeze_settlement_facts(text)','EXECUTE') job_freeze,
      has_function_privilege('shopapp','finance.freeze_settlement_facts(text)','EXECUTE') app_freeze,
      has_function_privilege('shopapp','finance.apply_settlement_adjustment_facts(text)','EXECUTE') app_adjust,
      has_function_privilege('shopjob','finance.apply_settlement_adjustment_facts(text)','EXECUTE') job_adjust,
      has_function_privilege('shopapp','finance.mark_platform_settlement_split_paid(text)','EXECUTE') app_platform_paid,
      has_function_privilege('shopjob','finance.mark_platform_settlement_split_paid(text)','EXECUTE') job_platform_paid,
      has_function_privilege('shopjob','finance.mark_partner_settlement_split_paid(text)','EXECUTE') job_partner_paid,
      has_function_privilege('shopapp','finance.mark_partner_settlement_split_paid(text)','EXECUTE') app_partner_paid`);
    expect(privileges.rows[0]).toEqual({
      app_journal_insert: false,
      job_journal_insert: false,
      app_entry_insert: false,
      job_entry_insert: false,
      app_ledger_insert: false,
      job_ledger_insert: false,
      app_subledger_insert: false,
      job_subledger_insert: false,
      app_subledger_entry_insert: false,
      job_subledger_entry_insert: false,
      app_line_insert: false,
      app_line_update: false,
      job_line_insert: false,
      job_line_update: false,
      app_split_insert: false,
      app_split_update: false,
      job_split_insert: false,
      job_split_update: false,
      app_adjustment_insert: true,
      app_adjustment_update: true,
      job_adjustment_insert: true,
      job_adjustment_update: true,
      app_withdrawal_insert: true,
      app_withdrawal_update: true,
      job_withdrawal_insert: true,
      job_withdrawal_update: true,
      service_any_write: false,
      job_freeze: true,
      app_freeze: false,
      app_adjust: true,
      job_adjust: false,
      app_platform_paid: true,
      job_platform_paid: false,
      job_partner_paid: true,
      app_partner_paid: false,
    });

    await expect(asRole(database, 'shopapp', `insert into finance.settlementline(id) values('line:tamper:app')`)).rejects.toThrow(/permission denied/i);
    await expect(asRole(database, 'shopjob', `insert into finance.settlementline(id) values('line:tamper:job')`)).rejects.toThrow(/permission denied/i);
    await expect(asRole(database, 'service_role', `update finance.split set amount_minor=1 where settlement_id='${settlement}'`)).rejects.toThrow(/permission denied/i);

    await expect(asRole(database, 'shopjob', `select finance.freeze_settlement_facts('${settlement}')`, 'api')).rejects.toThrow('FINANCE_SETTLEMENT_JOB_WRITE_REQUIRED');
    await expect(asRole(database, 'shopjob', `select finance.freeze_settlement_facts('${settlement}')`, 'jobs', actor, 'scope:other')).rejects.toThrow('FINANCE_SETTLEMENT_JOB_SCOPE_INVALID');
    await asRole(database, 'shopjob', `select finance.freeze_settlement_facts('${settlement}')`, 'jobs');
    await asRole(database, 'shopjob', `select finance.freeze_settlement_facts('${settlement}')`, 'jobs');
    const frozen = await database.query<{ lines: number; gross: number; invoice: number; splits: number; partner: number; platform: number }>(
      `select
      (select count(*)::integer from finance.settlementline where settlement_id=$1) lines,
      (select sum(case direction when 'decrease' then -amount_minor else amount_minor end)::integer
        from finance.settlementline where settlement_id=$1) gross,
      (select sum(invoice_minor)::integer from finance.settlementline where settlement_id=$1) invoice,
      (select count(*)::integer from finance.split where settlement_id=$1) splits,
      (select amount_minor::integer from finance.split where settlement_id=$1 and beneficiary_type='partner') partner,
      (select amount_minor::integer from finance.split where settlement_id=$1 and beneficiary_type='platform') platform`,
      [settlement]
    );
    expect(frozen.rows[0]).toEqual({ lines: 2, gross: 800, invoice: 720, splits: 2, partner: 720, platform: 80 });

    await database.exec(`insert into finance.settlementadjustment(
      id,settlement_id,settlement_line_id,scope_id,direction,amount_minor,tax_minor,state,
      requested_by,approved_by,reason,evidence,created_at,decided_at,version
    ) values(
      '${adjustment}','${settlement}','settlementline:item:base:payment','${scope}','decrease',100,0,'approved',
      'finance:requester','finance:reviewer','approved adjustment','{}',clock_timestamp(),clock_timestamp(),1
    );
    update finance.settlement set gross_minor=700,fee_minor=70,amount_minor=630,version=1,
      evidence=evidence||jsonb_build_object('lastAdjustment','${adjustment}') where id='${settlement}'`);

    await database.exec(`begin; update finance.settlement set fee_minor=71,amount_minor=629 where id='${settlement}'`);
    await database.query(
      `select set_config('app.scope_id',$1,true),set_config('app.actor_id','finance:reviewer',true),
      set_config('app.workload','api',true)`,
      [scope]
    );
    await database.exec('set role shopapp');
    await expect(database.query(`select finance.apply_settlement_adjustment_facts($1)`, [adjustment])).rejects.toThrow('FINANCE_SETTLEMENT_ADJUSTMENT_CALCULATION_STALE');
    await database.exec('rollback');
    await database.exec('reset role');

    await asRole(database, 'shopapp', `select finance.apply_settlement_adjustment_facts('${adjustment}')`, 'api', 'finance:reviewer');
    await asRole(database, 'shopapp', `select finance.apply_settlement_adjustment_facts('${adjustment}')`, 'api', 'finance:reviewer');
    await expect(asRole(database, 'shopapp', `update finance.split set amount_minor=1 where settlement_id='${settlement}'`)).rejects.toThrow(/permission denied/i);
    await expect(asRole(database, 'shopjob', `update finance.split set amount_minor=1 where settlement_id='${settlement}'`)).rejects.toThrow(/permission denied/i);
    const adjusted = await database.query<{ lines: number; gross: number; invoice: number; partner: number; platform: number }>(
      `select
      (select count(*)::integer from finance.settlementline where settlement_id=$1) lines,
      (select sum(case direction when 'decrease' then -amount_minor else amount_minor end)::integer
        from finance.settlementline where settlement_id=$1) gross,
      (select sum(case direction when 'decrease' then -invoice_minor else invoice_minor end)::integer
        from finance.settlementline where settlement_id=$1) invoice,
      (select amount_minor::integer from finance.split where settlement_id=$1 and beneficiary_type='partner') partner,
      (select amount_minor::integer from finance.split where settlement_id=$1 and beneficiary_type='platform') platform`,
      [settlement]
    );
    expect(adjusted.rows[0]).toEqual({ lines: 3, gross: 700, invoice: 630, partner: 630, platform: 70 });

    await database.exec(`update finance.settlement set state='payable',approved_by='finance:reviewer',approved_at=clock_timestamp()
      where id='${settlement}'`);
    await asRole(database, 'shopapp', `select finance.mark_platform_settlement_split_paid('${settlement}')`, 'api', 'finance:reviewer');
    await database.exec(`insert into finance.withdrawal(
      id,scope_id,settlement_id,amount_minor,currency,destination_ref,state,requested_by,approved_by,
      reason,evidence,provider_reference,created_at,updated_at,paid_at,version
    ) values(
      'withdrawal:write-boundary','${scope}','${settlement}',630,'CNY','destination:boundary','paid',
      'finance:requester','finance:reviewer','paid','{}','provider:boundary',clock_timestamp(),clock_timestamp(),clock_timestamp(),2
    ); update finance.settlement set state='paid',paid_at=clock_timestamp() where id='${settlement}'`);
    await expect(asRole(database, 'shopjob', `select finance.mark_partner_settlement_split_paid('${settlement}')`, 'api')).rejects.toThrow('FINANCE_SETTLEMENT_PARTNER_SPLIT_CONTEXT_INVALID');
    await expect(asRole(database, 'shopjob', `select finance.mark_partner_settlement_split_paid('${settlement}')`, 'jobs', actor, 'scope:other')).rejects.toThrow('FINANCE_SETTLEMENT_PARTNER_SPLIT_CONTEXT_INVALID');
    await asRole(database, 'shopjob', `select finance.mark_partner_settlement_split_paid('${settlement}')`, 'jobs');
    const paid = await database.query<{ partner: string; platform: string }>(
      `select
      (select state from finance.split where settlement_id=$1 and beneficiary_type='partner') partner,
      (select state from finance.split where settlement_id=$1 and beneficiary_type='platform') platform`,
      [settlement]
    );
    expect(paid.rows[0]).toEqual({ partner: 'paid', platform: 'paid' });
  }, 20_000);
});

async function asRole(database: PGlite, role: 'shopapp' | 'shopjob' | 'service_role', statement: string, workload: 'api' | 'jobs' = 'api', currentActor = actor, currentScope = scope): Promise<void> {
  await database.query(
    `select set_config('app.scope_id',$1,false),set_config('app.actor_id',$2,false),
    set_config('app.workload',$3,false)`,
    [currentScope, currentActor, workload]
  );
  await database.exec(`set role ${role}`);
  try {
    await database.exec(statement);
  } finally {
    await database.exec('reset role');
  }
}

async function replayThroughAccountingIntegrity(database: PGlite): Promise<void> {
  await database.exec(`create role anon nologin; create role authenticated nologin; create role service_role nologin;
    create schema supabase_migrations;
    create table supabase_migrations.schema_migrations(version text primary key,statements text[],name text);`);
  const files = (await readdir(migrations)).filter((name) => name.endsWith('.sql') && name <= '20260828094000_finance_invoice_issue_integrity.sql').sort();
  for (const name of files) {
    if (name === '20260817191000_bootstrap_ethan_platform_owner.sql') await seedOwner(database);
    if (name === '20260821026000_backfill_domain_data.sql') await stageSecrets(database);
    try {
      await database.exec(await readFile(`${migrations}/${name}`, 'utf8'));
    } catch (cause) {
      throw new Error(`MIGRATION_REPLAY_FAILED:${name}`, { cause });
    }
    await database.query('insert into supabase_migrations.schema_migrations(version,name) values($1,$2)', [name.slice(0, 14), name]);
  }
}

async function seedSettlement(database: PGlite): Promise<void> {
  await database.exec(`insert into channel.connection(
    id,provider,scope_id,status,contract_version,configuration,connection_timeout_ms,response_timeout_ms,
    total_deadline_ms,max_concurrency,requests_per_second,max_attempts,failure_threshold,recovery_ms,region
  ) values(
    'connection:write-boundary','wechat','${scope}','enabled','test','{}',1000,2000,3000,1,1,1,1,100,'local'
  );
  insert into channel.statement(
    id,connection_id,provider,scope_id,partner_id,period_start,period_end,timezone,object_ref,sha256,generated_at
  ) values(
    'statement:write-boundary','connection:write-boundary','wechat','${scope}','partner:write-boundary',
    '2026-08-01','2026-08-31','Asia/Shanghai','object:write-boundary',repeat('a',64),clock_timestamp()
  );
  insert into finance.policy(id,scope_id,kind,rule,state,version)
  values('policy:write-boundary','${scope}','settlement','{"basisPoints":1000,"invoiceBasis":"net"}','active',3);
  insert into finance.reconciliation(
    id,scope_id,provider,partner_id,period,statement_ref,statement_hash,state,debit_minor,credit_minor,
    difference_minor,created_by,approved_by,evidence,updated_at,version
  ) values(
    'reconciliation:write-boundary','${scope}','wechat','partner:write-boundary','2026-08-01/2026-08-31',
    'statement:write-boundary',repeat('a',64),'approved',800,800,0,'finance:requester','finance:reviewer','{}',clock_timestamp(),1
  );
  insert into finance.statementline(
    id,reconciliation_id,scope_id,sequence,external_reference,kind,amount_minor,tax_minor,currency,occurred_at,raw_hash
  ) values
    ('statementline:base:payment','reconciliation:write-boundary','${scope}',1,'external:payment','payment',1000,0,'CNY',clock_timestamp(),repeat('1',64)),
    ('statementline:base:refund','reconciliation:write-boundary','${scope}',2,'external:refund','refund',200,0,'CNY',clock_timestamp(),repeat('2',64)),
    ('statementline:late:detected','reconciliation:write-boundary','${scope}',3,'external:late:detected','payment',500,0,'CNY',clock_timestamp(),repeat('3',64)),
    ('statementline:late:refunded','reconciliation:write-boundary','${scope}',4,'external:late:refunded','refund',500,0,'CNY',clock_timestamp(),repeat('4',64));
  insert into finance.reconciliationitem(
    id,reconciliation_id,statement_line_id,scope_id,internal_type,internal_id,external_minor,internal_minor,
    difference_minor,state,reason_code,evidence,version,kind
  ) values
    ('item:base:payment','reconciliation:write-boundary','statementline:base:payment','${scope}','payment','payment:one',1000,1000,0,'matched',null,
      '{"journalReferenceType":"payment.succeeded","settlementEligible":true}',0,'payment'),
    ('item:base:refund','reconciliation:write-boundary','statementline:base:refund','${scope}','refund','refund:one',200,200,0,'matched',null,
      '{"journalReferenceType":"payment.refunded","settlementEligible":true}',0,'refund'),
    ('item:late:detected','reconciliation:write-boundary','statementline:late:detected','${scope}','payment','payment:late',500,500,0,'matched',null,
      '{"journalReferenceType":"payment.late.detected","settlementEligible":false}',0,'payment'),
    ('item:late:refunded','reconciliation:write-boundary','statementline:late:refunded','${scope}','refund','refund:late',500,500,0,'matched',null,
      '{"journalReferenceType":"payment.late.refunded","settlementEligible":false}',0,'refund');
  insert into finance.settlement(
    id,partner_id,period,reconciliation_id,amount_minor,currency,state,scope_id,requested_by,frozen_at,evidence,
    version,gross_minor,fee_minor,invoice_basis
  ) values(
    '${settlement}','partner:write-boundary','2026-08-01/2026-08-31','reconciliation:write-boundary',720,'CNY','draft',
    '${scope}','finance:requester',clock_timestamp(),'{}',0,800,80,'net'
  );
  update finance.settlement settlement set evidence=jsonb_build_object(
    'reconciliation',settlement.reconciliation_id,'statementHash',reconciliation.statement_hash,
    'payableBasis',jsonb_build_object(
      'itemCount',2,'itemHash',encode(public.digest(
        'item:base:payment:payment:payment:payment:one:1000:matched,item:base:refund:refund:refund:refund:one:200:matched','sha256'),'hex'),
      'grossMinor',800),
    'excludedLateBasis',jsonb_build_object(
      'itemCount',2,'itemHash',encode(public.digest(
        'item:late:detected:payment:payment:payment:late:500:matched,item:late:refunded:refund:refund:refund:late:500:matched','sha256'),'hex')),
    'settlementRule',jsonb_build_object(
      'id',policy.id,'version',policy.version,
      'hash',encode(public.digest(policy.id||':'||policy.version||':'||policy.rule::text,'sha256'),'hex'),'rule',policy.rule),
    'calculation',jsonb_build_object(
      'grossMinor',800,'feeMinor',80,'netMinor',720,'basisPoints',1000,'invoiceBasis','net'))
  from finance.reconciliation reconciliation,finance.policy policy
  where settlement.id='${settlement}' and reconciliation.id=settlement.reconciliation_id
    and policy.id='policy:write-boundary'`);
}

async function seedOwner(database: PGlite): Promise<void> {
  await database.exec(`insert into public.users(id,tenant_id,enterprise_id,department_id,employee_no,display_name,email,status)
    values('user-fresh-replay-ethan','tenant-smart-wing','enterprise-demo','department-digital','SW_FRESH_REPLAY_ETHAN',
      'Fresh Replay Ethan','fresh-replay@example.invalid','active');
    insert into public.members(id,user_id,primary_identifier,status)
    values('${actor}','user-fresh-replay-ethan','local_username:ethan','active');
    insert into public.member_login_aliases(provider,subject,member_id) values('local_username','ethan','${actor}');`);
}

async function stageSecrets(database: PGlite): Promise<void> {
  await database.exec(`insert into runtime.vouchersecretstage(voucher_id,code_ciphertext,code_fingerprint,key_version,staged_at)
    select id,'fixturekms:v1:'||encode(digest(voucher_code,'sha256'),'base64'),encode(digest(lower(voucher_code),'sha256'),'hex'),
      'fixture-v1',created_at from public.vouchers on conflict(voucher_id) do nothing;
    insert into runtime.partneraddressstage(store_id,address_ciphertext,address_token,key_version,staged_at)
    select id,'fixturekms:v1:'||encode(digest(address_text,'sha256'),'base64'),encode(digest(lower(address_text),'sha256'),'hex'),
      'fixture-v1',created_at from public.stores where address_text is not null on conflict(store_id) do nothing;
    insert into runtime.distributorcontactstage(distributor_id,contact_ciphertext,contact_token,key_version,staged_at)
    select id,'fixturekms:v1:'||encode(digest(contact_json::text,'sha256'),'base64'),encode(digest(contact_json::text,'sha256'),'hex'),
      'fixture-v1',created_at from public.distributors where contact_json<>'{}'::jsonb on conflict(distributor_id) do nothing;`);
}
