import type { QueryResultRow } from 'pg';
import type { ExecutionContext } from '../../../../pipeline/HandlerContext';
import { transactionOptions } from '../../../../pipeline/OperationContext';
import type { DatabasePool } from '../../../../platform/database/Pool';
import { pgContextParameters, pgContextValues } from '../../../../platform/database/PgContext';
import type { RegistrationPolicyRecord } from '../../application/port/RegistrationPolicyRepository';
import type { RegistrationPolicySnapshot } from '../../application/port/RegistrationPolicySnapshot';

interface RegistrationPolicySnapshotRow extends RegistrationPolicyRecord, QueryResultRow {
  readonly valid_until: Date | null;
}

interface CachedRegistrationPolicy {
  readonly policy: RegistrationPolicyRecord;
  readonly validUntil: number;
}

export class PgRegistrationPolicySnapshot implements RegistrationPolicySnapshot {
  private readonly queries: DatabasePool;
  private cached: CachedRegistrationPolicy | undefined;
  private pending: Promise<RegistrationPolicyRecord | null> | undefined;

  constructor(
    pool: DatabasePool,
    private readonly now: () => number = Date.now
  ) {
    this.queries = pool.workload('query');
  }

  async current(context: ExecutionContext<'identity.bootstrap.read'>): Promise<RegistrationPolicyRecord | null> {
    available(context, this.now());
    if (this.cached && this.cached.validUntil > this.now()) return this.cached.policy;
    const pending = this.pending ?? this.load(context);
    this.pending = pending;
    try {
      const policy = await pending;
      available(context, this.now());
      return policy;
    } finally {
      if (this.pending === pending) this.pending = undefined;
    }
  }

  private async load(context: ExecutionContext<'identity.bootstrap.read'>): Promise<RegistrationPolicyRecord | null> {
    const options = transactionOptions(context);
    const result = await this.queries.query<RegistrationPolicySnapshotRow>(
      `with request_context as materialized (${pgContextParameters(1)}),
      current_policy as materialized (
        select id,terms_title,terms_body,privacy_title,privacy_body,terms_hash,retired_at
        from identity.registrationpolicy where effective_at<=clock_timestamp()
          and (retired_at is null or retired_at>clock_timestamp()) order by version desc limit 1
      )
      select policy.id,policy.terms_title,policy.terms_body,policy.privacy_title,policy.privacy_body,policy.terms_hash,
        least(policy.retired_at,(select min(future.effective_at) from identity.registrationpolicy future
          where future.effective_at>clock_timestamp())) valid_until
      from request_context cross join current_policy policy`,
      pgContextValues(options)
    );
    const row = result.rows[0];
    if (!row) return null;
    const policy = Object.freeze({
      id: row.id,
      terms_title: row.terms_title,
      terms_body: row.terms_body,
      privacy_title: row.privacy_title,
      privacy_body: row.privacy_body,
      terms_hash: row.terms_hash,
    });
    this.cached = Object.freeze({ policy, validUntil: row.valid_until?.getTime() ?? Number.POSITIVE_INFINITY });
    return policy;
  }
}

function available(context: Readonly<{ deadline: number; signal: AbortSignal }>, now: number): void {
  if (context.signal.aborted) throw context.signal.reason ?? new Error('REGISTRATION_POLICY_READ_ABORTED');
  if (!Number.isFinite(context.deadline) || context.deadline <= now) throw new Error('DEADLINE_EXCEEDED');
}
