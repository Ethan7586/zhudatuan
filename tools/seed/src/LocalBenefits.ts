import { createHash } from 'node:crypto';
import type { Client } from 'pg';
import { LOCAL_CHECKER } from './LocalChecker';
import { LOCAL_OWNER } from './LocalOwner';

const EFFECTIVE_AT = '2026-01-01T00:00:00Z';
const EXPIRES_AT = '2099-12-31T15:59:59Z';
const PERIOD = '2026';
const BENEFITS = Object.freeze([Object.freeze({ kind: 'welfare', name: '年度福利金', amount: 500_000 }), Object.freeze({ kind: 'meal', name: '工作餐补', amount: 100_000 })] as const);
export const LOCAL_BENEFIT_GRANT = BENEFITS.reduce((total, benefit) => total + benefit.amount, 0);

export interface LocalBenefitLedger {
  readonly accounts: number;
  readonly balance: number;
  readonly grants: number;
  readonly lots: number;
  readonly remaining: number;
}

export async function ensureLocalBenefits(database: Client): Promise<void> {
  for (const benefit of BENEFITS) await ensureBenefit(database, benefit);
}

async function ensureBenefit(database: Client, benefit: (typeof BENEFITS)[number]): Promise<void> {
  const plan = `plan:local:${benefit.kind}`;
  const budget = `budget:local:${benefit.kind}:${PERIOD}`;
  const batch = `batch:local:${benefit.kind}:${PERIOD}`;
  const preferredAccount = `benefit:local:${benefit.kind}:ethan`;
  const lot = `lot:local:${benefit.kind}:ethan:${PERIOD}`;
  await ensureGrant(database, benefit, { plan, budget, batch });
  const account = await ensureAccount(database, benefit.kind, preferredAccount);
  await database.query(`select finance.post($1,'benefit.grant',$2,'CNY',$3,'benefit.expense','expense',$4,'liability',$5,$6)`, [LOCAL_OWNER.mall, batch, `${benefit.name}发放`, `benefit.${account}`, benefit.amount, EFFECTIVE_AT]);
  await database.query(
    `insert into benefit.lot(id,account_id,batch_id,member_id,total_minor,remaining_minor,state,effective_at,expires_at,origin,version)
    values($1,$2,$3,$4,$5,$5,'active',$6,$7,'grant',1)
    on conflict(id) do nothing`,
    [lot, account, batch, LOCAL_OWNER.member, benefit.amount, EFFECTIVE_AT, EXPIRES_AT]
  );
  await database.query(
    `insert into benefit.lotmovement(id,lot_id,kind,amount_minor,reference_type,reference_id,occurred_at)
    values($1,$2,'grant',$3,'grantbatch',$4,$5)
    on conflict(lot_id,kind,reference_type,reference_id) do nothing`,
    [`movement:${lot}`, lot, benefit.amount, batch, EFFECTIVE_AT]
  );
  await assertBenefit(database, benefit, { plan, budget, batch, account, lot });
}

async function ensureGrant(database: Client, benefit: (typeof BENEFITS)[number], ids: Readonly<{ plan: string; budget: string; batch: string }>): Promise<void> {
  await database.query(
    `insert into benefit.plan(id,scope_id,name,kind,currency,state,version) values($1,$2,$3,$4,'CNY','active',1)
    on conflict(id) do update set scope_id=excluded.scope_id,name=excluded.name,kind=excluded.kind,currency=excluded.currency,
      state='active',version=excluded.version`,
    [ids.plan, LOCAL_OWNER.mall, benefit.name, benefit.kind]
  );
  await database.query(
    `insert into benefit.planversion(plan_id,version,name,kind,currency,state,changed_by,changed_at)
    values($1,1,$2,$3,'CNY','active',$4,$5)
    on conflict(plan_id,version) do nothing`,
    [ids.plan, benefit.name, benefit.kind, LOCAL_OWNER.principal, EFFECTIVE_AT]
  );
  await database.query(
    `insert into benefit.budget(id,plan_id,period,total_minor,granted_minor,reserved_minor,version)
    values($1,$2,$3,$4,$4,0,1)
    on conflict(id) do nothing`,
    [ids.budget, ids.plan, PERIOD, benefit.amount]
  );
  const snapshot = createHash('sha256').update(`${LOCAL_OWNER.member}:${benefit.amount}`).digest('hex');
  await database.query(
    `insert into benefit.grantbatch(id,plan_id,budget_id,state,requested_by,approved_by,requested_count,amount_minor,
      reason,created_at,updated_at,plan_version,effective_at,expires_at,timezone,snapshot_hash)
    values($1,$2,$3,'completed',$4,$5,1,$6,'本地 MVP 验收福利发放',$7,$7,1,$7,$8,'Asia/Shanghai',$9)
    on conflict(id) do nothing`,
    [ids.batch, ids.plan, ids.budget, LOCAL_OWNER.principal, LOCAL_CHECKER.principal, benefit.amount, EFFECTIVE_AT, EXPIRES_AT, snapshot]
  );
  await database.query(
    `insert into benefit.grantitem(batch_id,member_id,amount_minor,state,error_code) values($1,$2,$3,'granted',null)
    on conflict(batch_id,member_id) do nothing`,
    [ids.batch, LOCAL_OWNER.member, benefit.amount]
  );
}

async function assertBenefit(database: Client, benefit: (typeof BENEFITS)[number], ids: Readonly<{ plan: string; budget: string; batch: string; account: string; lot: string }>): Promise<void> {
  const snapshot = createHash('sha256').update(`${LOCAL_OWNER.member}:${benefit.amount}`).digest('hex');
  const result = await database.query<{ valid: boolean }>(
    `select
      exists(select 1 from benefit.plan where id=$1 and scope_id=$6 and name=$7 and kind=$8 and currency='CNY' and state='active')
      and exists(select 1 from benefit.planversion where plan_id=$1 and version=1 and name=$7 and kind=$8 and currency='CNY'
        and state='active' and changed_by=$9 and changed_at=$10)
      and exists(select 1 from benefit.budget where id=$2 and plan_id=$1 and period=$11 and total_minor=$12
        and granted_minor=$12 and reserved_minor=0)
      and exists(select 1 from benefit.grantbatch where id=$3 and plan_id=$1 and budget_id=$2 and state='completed'
        and requested_by=$9 and approved_by=$13 and requested_count=1 and amount_minor=$12 and reason='本地 MVP 验收福利发放'
        and plan_version=1 and effective_at=$10 and expires_at=$14 and timezone='Asia/Shanghai' and snapshot_hash=$15)
      and exists(select 1 from benefit.grantitem where batch_id=$3 and member_id=$16 and amount_minor=$12 and state='granted' and error_code is null)
      and exists(select 1 from benefit.account where id=$4 and member_id=$16 and scope_id=$6 and kind=$8 and currency='CNY'
        and status='active')
      and exists(select 1 from benefit.lot where id=$5 and account_id=$4 and batch_id=$3 and member_id=$16
        and total_minor=$12 and remaining_minor between 0 and $12 and state in('active','consumed')
        and effective_at=$10 and expires_at=$14 and origin='grant')
      and exists(select 1 from benefit.lotmovement where lot_id=$5 and kind='grant' and amount_minor=$12
        and reference_type='grantbatch' and reference_id=$3 and occurred_at=$10) valid`,
    [ids.plan, ids.budget, ids.batch, ids.account, ids.lot, LOCAL_OWNER.mall, benefit.name, benefit.kind, LOCAL_OWNER.principal, EFFECTIVE_AT, PERIOD, benefit.amount, LOCAL_CHECKER.principal, EXPIRES_AT, snapshot, LOCAL_OWNER.member]
  );
  if (result.rows[0]?.valid !== true) throw new Error(`LOCAL_BENEFIT_CONTRACT_MISMATCH:${benefit.kind}`);
}

export function assertLocalBenefitLedger(ledger: LocalBenefitLedger): void {
  if (ledger.accounts !== BENEFITS.length || ledger.lots !== BENEFITS.length || ledger.grants !== LOCAL_BENEFIT_GRANT) {
    throw new Error(`LOCAL_BENEFIT_BASELINE_INCONSISTENT:${JSON.stringify(ledger)}`);
  }
  if (!Number.isSafeInteger(ledger.balance) || !Number.isSafeInteger(ledger.remaining) || ledger.balance < 0 || ledger.remaining < 0 || ledger.balance !== ledger.remaining) {
    throw new Error(`LOCAL_BENEFIT_LEDGER_UNBALANCED:${JSON.stringify(ledger)}`);
  }
}

async function ensureAccount(database: Client, kind: (typeof BENEFITS)[number]['kind'], preferred: string): Promise<string> {
  const finance = await database.query<{ id: string }>(`select finance.ensure_account($1,$2,'CNY','liability') id`, [LOCAL_OWNER.mall, `benefit.${preferred}`]);
  const financeAccount = finance.rows[0]?.id;
  if (!financeAccount) throw new Error(`LOCAL_BENEFIT_FINANCE_ACCOUNT_MISSING:${kind}`);
  const result = await database.query<{ id: string }>(
    `insert into benefit.account(id,member_id,scope_id,kind,currency,status,version,finance_account_id)
    values($1,$2,$3,$4,'CNY','active',1,$5)
    on conflict(member_id,scope_id,kind,currency) do update set status='active',finance_account_id=excluded.finance_account_id,
      version=benefit.account.version+case when (benefit.account.status,benefit.account.finance_account_id)
        is distinct from ('active',excluded.finance_account_id) then 1 else 0 end returning id`,
    [preferred, LOCAL_OWNER.member, LOCAL_OWNER.mall, kind, financeAccount]
  );
  const account = result.rows[0]?.id;
  if (!account) throw new Error(`LOCAL_BENEFIT_ACCOUNT_MISSING:${kind}`);
  return account;
}
