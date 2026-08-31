import type { Telemetry, TelemetryContext } from '@shop/telemetry';
import type { ClaimedJob, JobProcessor } from '../../../../foundation/application/JobRunner';
import type { DatabasePool } from '../../../../foundation/persistence/Pool';
import { invitationRateBuckets } from '../../domain/policy/InvitationRatePolicy';

interface Cursor {
  readonly state: string;
  readonly expires: Date;
  readonly id: string;
}
interface InvitationExpiry extends Cursor {
  readonly kind: string;
  readonly target: string;
  readonly organization: string;
}

export class InvitationCleanupJob implements JobProcessor {
  constructor(
    private readonly pool: DatabasePool,
    private readonly telemetry: Telemetry,
    private readonly batch = 200
  ) {
    if (!Number.isInteger(batch) || batch < 1 || batch > 200) throw new Error('INVITATION_CLEANUP_BATCH_INVALID');
  }

  async process(job: ClaimedJob, signal: AbortSignal): Promise<void> {
    if (job.kind !== 'invitationcleanup') throw new Error('JOB_KIND_MISMATCH');
    const context: TelemetryContext = { requestId: job.id, traceId: trace(job), module: 'identity', job: job.kind, attempt: job.attempts };
    const invitations = await this.expireInvitations(job, signal);
    const claims = await this.expireClaims(signal);
    const preauth = await this.expirePreauth(signal);
    const rates = await this.expireRates(signal);
    this.telemetry.metrics.count('identity_invitation_stale_total', invitations, context);
    const active = await this.pool.query<{ count: string }>(`select count(*)::text count from identity.invitationclaim
      where state in('reserved','proofpending','proved') and expires_at>clock_timestamp()`);
    this.telemetry.metrics.count('identity_invitation_claim_active', Number(active.rows[0]?.count ?? 0), context);
    this.telemetry.metrics.count('identity_invitation_cleanup_total', claims + preauth + rates, { ...context, result: 'success', resourceType: 'claimpreauth' });
  }

  private async expireInvitations(job: ClaimedJob, signal: AbortSignal): Promise<number> {
    let cursor: Cursor | undefined;
    let total = 0;
    do {
      assertRunning(signal);
      const client = await this.pool.connect();
      let rows: readonly InvitationExpiry[] = [];
      try {
        await client.query('begin');
        const result = await client.query<InvitationExpiry>(
          `with selected as(
          select id,status state,expires_at expires from identity.invitation
          where status='active' and expires_at<=clock_timestamp()
            and ($1::text is null or (status,expires_at,id)>($1,$2,$3))
          order by status,expires_at,id limit $4 for update skip locked
        ),expired as(
          update identity.invitation invitation set status='expired',version=version+1,updated_at=clock_timestamp()
          from selected where invitation.id=selected.id and invitation.status='active'
          returning invitation.id,invitation.kind,invitation.target,invitation.organization_id
        ),events as(
          insert into runtime.outbox(id,event_type,event_version,aggregate_type,aggregate_id,scope_id,payload,trace_id,occurred_at,available_at)
          select 'event:'||gen_random_uuid(),'identity.invitation.expired',1,'invitation',expired.id,expired.organization_id,
            jsonb_build_object('invitationId',expired.id,'kind',expired.kind,'target',expired.target),$5,clock_timestamp(),clock_timestamp()
          from expired returning aggregate_id
        ) select selected.state,selected.expires,selected.id,expired.kind,expired.target,expired.organization_id organization
          from selected join expired using(id) order by selected.state,selected.expires,selected.id`,
          [cursor?.state ?? null, cursor?.expires ?? null, cursor?.id ?? null, this.batch, trace(job)]
        );
        rows = result.rows;
        await client.query('commit');
      } catch (cause) {
        await client.query('rollback');
        throw cause;
      } finally {
        client.release();
      }
      total += rows.length;
      cursor = rows.at(-1);
      if (rows.length < this.batch) break;
    } while (true);
    return total;
  }

  private async expireClaims(signal: AbortSignal): Promise<number> {
    return this.expireRows(
      signal,
      `with selected as(
      select id,state,expires_at expires from identity.invitationclaim
      where state in('reserved','proofpending','proved') and expires_at<=clock_timestamp()
        and ($1::text is null or (state,expires_at,id) > ($1,$2,$3::uuid))
      order by state,expires_at,id limit $4 for update skip locked
    ),expired as(update identity.invitationclaim claim set state='expired',updated_at=clock_timestamp(),version=version+1
      from selected where claim.id=selected.id and claim.state in('reserved','proofpending','proved') returning claim.id)
    select selected.state,selected.expires,selected.id::text id from selected join expired using(id)
    order by selected.state,selected.expires,selected.id`
    );
  }

  private async expirePreauth(signal: AbortSignal): Promise<number> {
    return this.expireRows(
      signal,
      `with selected as(
      select id,purpose state,expires_at expires from identity.preauth
      where purpose in('invitationproof','enrollment') and state='active' and expires_at<=clock_timestamp()
        and ($1::text is null or (purpose,expires_at,id) > ($1,$2,$3::uuid))
      order by purpose,expires_at,id limit $4 for update skip locked
    ),expired as(update identity.preauth preauth set state='expired',version=version+1
      from selected where preauth.id=selected.id and preauth.state='active' returning preauth.id)
    select selected.state,selected.expires,selected.id::text id from selected join expired using(id)
    order by selected.state,selected.expires,selected.id`
    );
  }

  private async expireRates(signal: AbortSignal): Promise<number> {
    let total = 0;
    const buckets = invitationRateBuckets();
    do {
      assertRunning(signal);
      const client = await this.pool.connect();
      let deleted = 0;
      try {
        await client.query('begin');
        await client.query("select set_config('app.workload','jobs',true),set_config('app.job_kind','invitationcleanup',true)");
        const result = await client.query<{ count: string }>(
          `with selected as(
          select ctid from identity.loginattempt where client_hash=any($1::text[])
            and window_started_at<clock_timestamp()-interval '24 hours' limit $2
        ),deleted as(delete from identity.loginattempt attempt using selected where attempt.ctid=selected.ctid returning 1)
        select count(*)::text count from deleted`,
          [buckets, this.batch]
        );
        deleted = Number(result.rows[0]?.count ?? 0);
        await client.query('commit');
      } catch (cause) {
        await client.query('rollback');
        throw cause;
      } finally {
        client.release();
      }
      total += deleted;
      if (deleted < this.batch) break;
    } while (true);
    return total;
  }

  private async expireRows(signal: AbortSignal, sql: string): Promise<number> {
    let cursor: Cursor | undefined;
    let total = 0;
    do {
      assertRunning(signal);
      const client = await this.pool.connect();
      let rows: readonly Cursor[] = [];
      try {
        await client.query('begin');
        const result = await client.query<Cursor>(sql, [cursor?.state ?? null, cursor?.expires ?? null, cursor?.id ?? null, this.batch]);
        rows = result.rows;
        await client.query('commit');
      } catch (cause) {
        await client.query('rollback');
        throw cause;
      } finally {
        client.release();
      }
      total += rows.length;
      cursor = rows.at(-1);
      if (rows.length < this.batch) break;
    } while (true);
    return total;
  }
}

function assertRunning(signal: AbortSignal): void {
  if (signal.aborted) throw signal.reason ?? new Error('JOB_ABORTED');
}
function trace(job: ClaimedJob): string {
  if (job.payload && typeof job.payload === 'object' && !Array.isArray(job.payload)) {
    const value = Reflect.get(job.payload, 'traceId');
    if (typeof value === 'string' && value) return value;
  }
  return job.id;
}
