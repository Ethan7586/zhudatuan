import { createHash } from 'node:crypto';
import type { Client } from 'pg';
import { LOCAL_CHECKER } from './LocalChecker';
import { LOCAL_OWNER } from './LocalOwner';

const EFFECTIVE_AT = '2026-01-01T00:00:00Z';
const EXPIRES_AT = '2099-12-31T15:59:59Z';
const PERIOD = '2026';
const BENEFITS = Object.freeze([Object.freeze({ kind: 'welfare', name: '年度福利金', amount: 500_000 }), Object.freeze({ kind: 'meal', name: '工作餐补', amount: 100_000 })] as const);

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
    on conflict(id) do update set account_id=excluded.account_id,batch_id=excluded.batch_id,member_id=excluded.member_id,
      total_minor=excluded.total_minor,remaining_minor=excluded.remaining_minor,state='active',effective_at=excluded.effective_at,
      expires_at=excluded.expires_at,origin='grant',version=excluded.version`,
    [lot, account, batch, LOCAL_OWNER.member, benefit.amount, EFFECTIVE_AT, EXPIRES_AT]
  );
  await database.query(
    `insert into benefit.lotmovement(id,lot_id,kind,amount_minor,reference_type,reference_id,occurred_at)
    values($1,$2,'grant',$3,'grantbatch',$4,$5)
    on conflict(lot_id,kind,reference_type,reference_id) do update set amount_minor=excluded.amount_minor,occurred_at=excluded.occurred_at`,
    [`movement:${lot}`, lot, benefit.amount, batch, EFFECTIVE_AT]
  );
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
    on conflict(plan_id,version) do update set name=excluded.name,kind=excluded.kind,currency=excluded.currency,
      state=excluded.state,changed_by=excluded.changed_by,changed_at=excluded.changed_at`,
    [ids.plan, benefit.name, benefit.kind, LOCAL_OWNER.principal, EFFECTIVE_AT]
  );
  await database.query(
    `insert into benefit.budget(id,plan_id,period,total_minor,granted_minor,reserved_minor,version)
    values($1,$2,$3,$4,$4,0,1)
    on conflict(id) do update set plan_id=excluded.plan_id,period=excluded.period,total_minor=excluded.total_minor,
      granted_minor=excluded.granted_minor,reserved_minor=0,version=excluded.version`,
    [ids.budget, ids.plan, PERIOD, benefit.amount]
  );
  const snapshot = createHash('sha256').update(`${LOCAL_OWNER.member}:${benefit.amount}`).digest('hex');
  await database.query(
    `insert into benefit.grantbatch(id,plan_id,budget_id,state,requested_by,approved_by,requested_count,amount_minor,
      reason,created_at,updated_at,plan_version,effective_at,expires_at,timezone,snapshot_hash)
    values($1,$2,$3,'completed',$4,$5,1,$6,'本地 MVP 验收福利发放',$7,$7,1,$7,$8,'Asia/Shanghai',$9)
    on conflict(id) do update set plan_id=excluded.plan_id,budget_id=excluded.budget_id,state='completed',
      requested_by=excluded.requested_by,approved_by=excluded.approved_by,requested_count=excluded.requested_count,
      amount_minor=excluded.amount_minor,reason=excluded.reason,plan_version=excluded.plan_version,
      effective_at=excluded.effective_at,expires_at=excluded.expires_at,timezone=excluded.timezone,snapshot_hash=excluded.snapshot_hash,
      pause_reason=null,updated_at=excluded.updated_at`,
    [ids.batch, ids.plan, ids.budget, LOCAL_OWNER.principal, LOCAL_CHECKER.principal, benefit.amount, EFFECTIVE_AT, EXPIRES_AT, snapshot]
  );
  await database.query(
    `insert into benefit.grantitem(batch_id,member_id,amount_minor,state,error_code) values($1,$2,$3,'granted',null)
    on conflict(batch_id,member_id) do update set amount_minor=excluded.amount_minor,state='granted',error_code=null`,
    [ids.batch, LOCAL_OWNER.member, benefit.amount]
  );
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
