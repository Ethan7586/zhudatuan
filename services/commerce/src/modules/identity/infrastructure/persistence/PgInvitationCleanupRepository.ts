import { randomUUID } from 'node:crypto';
import { PgRuntimeWriter } from '../../../../platform/database/PgRuntimeWriter';
import { PgTransactionAccess } from '../../../../platform/database/PgTransactionAccess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import type { CleanupCursor, InvitationCleanupRepository } from '../../application/port/CleanupRepository';

interface InvitationExpiry extends CleanupCursor {
  readonly kind: string;
  readonly target: string;
  readonly organization: string;
}

export class PgInvitationCleanupRepository implements InvitationCleanupRepository {
  private readonly transactions = new PgTransactionAccess();

  async expireInvitations(context: WriteTransactionContext, cursor: CleanupCursor | undefined, batch: number, trace: string): Promise<readonly CleanupCursor[]> {
    const database = this.transactions.database(context);
    const result = await database.query<InvitationExpiry>(
      `with selected as(
      select id,status state,expires_at expires from identity.invitation
      where status='active' and expires_at<=clock_timestamp()
        and ($1::text is null or (status,expires_at,id)>($1,$2,$3))
      order by status,expires_at,id limit $4 for update skip locked
    ),expired as(
      update identity.invitation invitation set status='expired',version=version+1,updated_at=clock_timestamp()
      from selected where invitation.id=selected.id and invitation.status='active'
      returning invitation.id,invitation.kind,invitation.target,invitation.organization_id
    ) select selected.state,selected.expires,selected.id,expired.kind,expired.target,expired.organization_id organization
      from selected join expired using(id) order by selected.state,selected.expires,selected.id`,
      [cursor?.state ?? null, cursor?.expires ?? null, cursor?.id ?? null, batch]
    );
    const runtime = new PgRuntimeWriter(database);
    for (const invitation of result.rows) {
      await runtime.append({
        id: `event:${randomUUID()}`,
        type: 'identity.invitation.expired',
        aggregateType: 'invitation',
        aggregate: invitation.id,
        scope: invitation.organization,
        payload: { invitationId: invitation.id, kind: invitation.kind, target: invitation.target },
        trace,
      });
    }
    return Object.freeze(result.rows);
  }

  expireClaims(context: WriteTransactionContext, cursor: CleanupCursor | undefined, batch: number): Promise<readonly CleanupCursor[]> {
    return this.expireRows(
      context,
      cursor,
      batch,
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

  expirePreauth(context: WriteTransactionContext, cursor: CleanupCursor | undefined, batch: number): Promise<readonly CleanupCursor[]> {
    return this.expireRows(
      context,
      cursor,
      batch,
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

  async expireRates(context: WriteTransactionContext, buckets: readonly string[], batch: number): Promise<number> {
    const result = await this.transactions.database(context).query<{ count: string }>(
      `with selected as(
      select ctid from identity.loginattempt where client_hash=any($1::text[])
        and window_started_at<clock_timestamp()-interval '24 hours' limit $2
    ),deleted as(delete from identity.loginattempt attempt using selected where attempt.ctid=selected.ctid returning 1)
    select count(*)::text count from deleted`,
      [buckets, batch]
    );
    return Number(result.rows[0]?.count ?? 0);
  }

  async activeClaims(context: ReadTransactionContext): Promise<number> {
    const result = await this.transactions.database(context).query<{ count: string }>(
      `select count(*)::text count from identity.invitationclaim
      where state in('reserved','proofpending','proved') and expires_at>clock_timestamp()`
    );
    return Number(result.rows[0]?.count ?? 0);
  }

  private async expireRows(context: WriteTransactionContext, cursor: CleanupCursor | undefined, batch: number, sql: string): Promise<readonly CleanupCursor[]> {
    const result = await this.transactions.database(context).query<CleanupCursor>(sql, [cursor?.state ?? null, cursor?.expires ?? null, cursor?.id ?? null, batch]);
    return Object.freeze(result.rows);
  }
}
