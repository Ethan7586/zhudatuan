import { createHash, randomUUID } from 'node:crypto';
import { PgRuntimeWriter } from '../../../../adapter/database/PgRuntimeWriter';
import type { SqlExecutor } from '../../../../adapter/database/PgTransactionAccess';
import type { WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { BenefitAccountingPort } from '../../../finance/public/index';

export interface Batch {
  readonly id: string;
  readonly scope_id: string;
  readonly kind: string;
  readonly currency: string;
  readonly budget_id: string;
  readonly effective_at: string;
  readonly expires_at: string;
  readonly state: string;
}

export interface GrantItem {
  readonly member_id: string;
  readonly amount_minor: number;
}

export async function lockBatch(client: SqlExecutor, batch: string): Promise<Batch | undefined> {
  const result = await client.query<Batch>(
    `select batch.id,plan.scope_id,version.kind,version.currency,batch.budget_id,batch.effective_at,
    batch.expires_at,batch.state from benefit.grantbatch batch join benefit.plan plan on plan.id=batch.plan_id
    join benefit.planversion version on version.plan_id=batch.plan_id and version.version=batch.plan_version where batch.id=$1 for update of batch`,
    [batch]
  );
  return result.rows[0];
}

export async function itemCounts(client: SqlExecutor, batch: string) {
  const result = await client.query<{ queued: number; scheduled: number }>(
    `select count(*) filter(where state='queued')::integer queued,
    count(*) filter(where state='scheduled')::integer scheduled from benefit.grantitem where batch_id=$1`,
    [batch]
  );
  return result.rows[0]!;
}

export async function releaseReserved(client: SqlExecutor, budget: string, amount: number) {
  const changed = await client.query(
    `update benefit.budget set reserved_minor=reserved_minor-$2,version=version+1
    where id=$1 and reserved_minor>=$2 returning id`,
    [budget, amount]
  );
  if (!changed.rows[0]) throw new Error('BENEFIT_RESERVED_BUDGET_INTEGRITY_FAILED');
}

export async function moveReservedToGranted(client: SqlExecutor, budget: string, amount: number) {
  const changed = await client.query(
    `update benefit.budget set reserved_minor=reserved_minor-$2,granted_minor=granted_minor+$2,version=version+1
    where id=$1 and reserved_minor>=$2 returning id`,
    [budget, amount]
  );
  if (!changed.rows[0]) throw new Error('BENEFIT_BUDGET_TRANSITION_FAILED');
}

export async function post(
  finance: Pick<BenefitAccountingPort, 'post'>,
  context: WriteTransactionContext,
  scope: string,
  referenceType: string,
  referenceId: string,
  currency: string,
  description: string,
  debitCode: string,
  debitKind: string,
  creditCode: string,
  creditKind: string,
  amount: number,
  occurred?: string
) {
  await finance.post(context, {
    scope,
    referenceType,
    referenceId,
    currency,
    description,
    debit: { code: debitCode, kind: financeKind(debitKind) },
    credit: { code: creditCode, kind: financeKind(creditKind) },
    amountMinor: amount,
    ...(occurred === undefined ? {} : { occurredAt: occurred }),
  });
}

export async function event(client: SqlExecutor, type: string, aggregateType: string, aggregate: string, scope: string, payload: unknown, key: string) {
  const id = `event:${digest(key)}`;
  await new PgRuntimeWriter(client).append({ id, type, aggregateType, aggregate, scope, payload: object(payload), trace: id });
}

export async function enqueue(client: SqlExecutor, scope: string, payload: unknown) {
  await new PgRuntimeWriter(client).schedule({ id: `job:${randomUUID()}`, kind: 'benefitgrant', owner: 'benefit', scope, payload: object(payload), priority: 20 });
}

export function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
export function financeKind(value: string): 'asset' | 'liability' | 'income' | 'expense' {
  if (!['asset', 'liability', 'income', 'expense'].includes(value)) throw new Error('FINANCE_ACCOUNT_KIND_INVALID');
  return value as 'asset' | 'liability' | 'income' | 'expense';
}
export function object(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('JOB_PAYLOAD_INVALID');
  return value as Record<string, unknown>;
}
export function text(value: unknown, code: string): string {
  if (typeof value !== 'string' || !value) throw new Error(code);
  return value;
}
