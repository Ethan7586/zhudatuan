import { createHash, randomUUID } from 'node:crypto';
import { DomainError } from '../../../../foundation/domain/DomainError';
import { PgRuntimeWriter, type RuntimeSql } from '../../../../adapter/database/PgRuntimeWriter';

export async function cancelUnexecuted(database: Queryable, batch: string, budget: string) {
  const released = await database.query(
    `with changed as(update benefit.grantitem set state='skipped',error_code='BATCH_CANCELLED'
    where batch_id=$1 and state in('queued','scheduled') returning amount_minor)
    select coalesce(sum(amount_minor),0)::float8 amount from changed`,
    [batch]
  );
  const amount = Number(released.rows[0]?.amount ?? 0);
  if (amount > 0) await database.query(`update benefit.budget set reserved_minor=reserved_minor-$2,version=version+1 where id=$1 and reserved_minor>=$2`, [budget, amount]);
  await database.query(`update benefit.lot set state='revoked',remaining_minor=0,version=version+1 where batch_id=$1 and state='pending'`, [batch]);
}

export async function actionRecord(database: Queryable, batch: string, action: string, actor: string, reason: string, evidence: Readonly<Record<string, unknown>>) {
  await database.query(
    `insert into benefit.action(id,batch_id,action,actor_id,reason,evidence,occurred_at)
    values($1,$2,$3,$4,$5,$6::jsonb,clock_timestamp())`,
    [`action:${randomUUID()}`, batch, action, actor, reason, JSON.stringify(evidence)]
  );
}

export async function enqueue(database: Queryable, scope: string, payload: unknown, id = `job:${randomUUID()}`) {
  await new PgRuntimeWriter(database as unknown as RuntimeSql).schedule({ id, kind: 'benefitgrant', owner: 'benefit', scope, payload: record(payload), priority: 20 });
}

export interface Queryable {
  query(text: string, values?: readonly unknown[]): Promise<{ readonly rows: readonly Record<string, unknown>[] }>;
}

export function memberSnapshot(value: unknown): readonly string[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 100_000 || value.some((member) => typeof member !== 'string' || member.length === 0)) {
    throw new DomainError('VALIDATION_FAILED', { field: 'members' });
  }
  const members = [...new Set(value as string[])].sort();
  if (members.length !== value.length) throw new Error('BENEFIT_MEMBER_DUPLICATE');
  return members;
}

export function instant(value: unknown, field: string): Date {
  if (typeof value !== 'string') throw new DomainError('VALIDATION_FAILED', { field: field });
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.valueOf())) throw new DomainError('VALIDATION_FAILED', { field: field });
  return parsed;
}

export function record(value: unknown): Readonly<Record<string, unknown>> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Readonly<Record<string, unknown>>) : {};
}

export function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
