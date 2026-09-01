import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import { randomUUID } from 'node:crypto';
import { PgRuntimeWriter } from '../../../../adapter/database/PgRuntimeWriter';
import { DomainError } from '../../../../foundation/domain/DomainError';
import type { MemberAccessPort } from '../../../access/public';
import type { OrganizationReadPort } from '../../../organization/public';
import type { VerificationVoucherPort } from '../../../voucher/public';
import type { AttemptRepository } from '../../application/port/AttemptRepository';
import type { ChallengeRepository } from '../../application/port/ChallengeRepository';
import type { DeviceRepository } from '../../application/port/DeviceRepository';
import type { SessionRepository } from '../../application/port/SessionRepository';
export class PgVerificationRepository implements SessionRepository, ChallengeRepository, DeviceRepository, AttemptRepository {
  constructor(
    private readonly transactions: PgTransactionAccess,
    private readonly members: MemberAccessPort,
    private readonly organizations: OrganizationReadPort,
    private readonly vouchers: VerificationVoucherPort
  ) {}
  async read(context: ReadTransactionContext, _scope: string, membership: string, page: Parameters<SessionRepository['read']>[3]) {
    const database = this.transactions.database(context);
    const member = await this.members.member(context, membership);
    const result = await database.query(
      `select session.id,session.subject_type,session.subject_id,session.purpose,session.state,session.expires_at,session.version
      from verification.session session where session.subject_id=$1
      and ($2::timestamptz is null or (session.expires_at,session.id)<($2::timestamptz,$3))
      order by session.expires_at desc,session.id desc limit $4`,
      [member, page.sort, page.id, page.fetch]
    );
    return rows(result.rows);
  }
  async issue(context: WriteTransactionContext, input: Parameters<ChallengeRepository['issue']>[1]) {
    const database = this.transactions.database(context);
    const member = await this.members.profile(context, input.membership);
    let subjectType = 'member';
    let subject = member.member;
    let scope = member.organization;
    if (input.purpose === 'voucher_redeem') {
      if (!input.voucher) throw new DomainError('VALIDATION_FAILED', { field: 'voucher' });
      subjectType = 'voucher';
      subject = input.voucher;
      const voucherScope = await this.vouchers.redeemableScope(context, subject, member.member);
      if (!voucherScope) throw new DomainError('VOUCHER_NOT_REDEEMABLE');
      scope = voucherScope;
    }
    const result = await database.query(
      `with session as (insert into verification.session(id,scope_id,subject_type,subject_id,purpose,state,expires_at,version)
      values($1,$2,$3,$4,$5,'issued',clock_timestamp()+interval '60 seconds',0) returning id,subject_type,subject_id,purpose,state,expires_at,version),
      nonce as (insert into verification.nonce(session_id,nonce_hash,issued_at) values($1,$6,clock_timestamp()))
      select id,subject_type,subject_id,purpose,state,expires_at,version from session`,
      [input.id, scope, subjectType, subject, input.purpose, input.nonceHash]
    );
    return required(result.rows[0], 'VERIFICATION_CHALLENGE_ISSUE_FAILED');
  }
  async verify(context: WriteTransactionContext, input: Parameters<ChallengeRepository['verify']>[1]) {
    const database = this.transactions.database(context);
    const device = await database.query<{
      id: string;
    }>(`select id from verification.device where scope_id=$1 and fingerprint_hash=$2 and status='trusted'`, [input.scope, input.deviceHash]);
    if (!device.rows[0]) throw new DomainError('VERIFICATION_DEVICE_DENIED');
    const visibleScopes = [input.scope, ...(await this.organizations.scope(context, input.scope)).ancestors];
    const consumed = await database.query<{
      subject_type: string;
      subject_id: string;
      purpose: string;
      scope_id: string;
    }>(
      `with consumed as (update verification.nonce nonce set consumed_at=clock_timestamp() from verification.session session
      where nonce.session_id=$1 and nonce.nonce_hash=$2 and nonce.consumed_at is null and session.id=nonce.session_id
      and session.scope_id=any($3::text[]) and session.state='issued' and session.expires_at>clock_timestamp()
      returning session.subject_type,session.subject_id,session.purpose,session.scope_id),
      changed as (update verification.session set state='verified',version=version+1 where id=$1 and exists(select 1 from consumed) returning id)
      select subject_type,subject_id,purpose,scope_id from consumed`,
      [input.challenge, input.nonceHash, visibleScopes]
    );
    const verified = consumed.rows[0];
    await database.query(
      `insert into verification.attempt(id,session_id,nonce_hash,device_id,result,reason,trace_id,attempted_at)
      values($1,$2,$3,$4,$5,$6,$7,clock_timestamp()) on conflict(session_id,nonce_hash) do nothing`,
      [`attempt:${randomUUID()}`, input.challenge, input.nonceHash, device.rows[0].id, verified ? 'accepted' : 'replayed', verified ? 'verified' : 'nonce_unavailable', input.trace]
    );
    if (!verified) throw new DomainError('VERIFICATION_NONCE_REPLAYED');
    const record = verified.purpose === 'voucher_redeem' ? await this.redeem(context, database, verified.subject_id, input.challenge, verified.scope_id, input.actor, input.scope, input.trace) : `attempt:${input.challenge}`;
    return Object.freeze({ record, verified: true, subjectType: verified.subject_type, subject: verified.subject_id, purpose: verified.purpose });
  }
  async history(context: ReadTransactionContext, scope: string, page: Parameters<AttemptRepository['history']>[2]) {
    const database = this.transactions.database(context);
    const visibleScopes = [scope, ...(await this.organizations.scope(context, scope)).ancestors];
    const result = await database.query(
      `select attempt.id,attempt.session_id,session.subject_type,session.subject_id,session.purpose,
      attempt.device_id,attempt.result,attempt.reason,attempt.attempted_at from verification.attempt attempt
      join verification.session session on session.id=attempt.session_id where session.scope_id=any($1::text[])
      and ($2::timestamptz is null or (attempt.attempted_at,attempt.id)<($2::timestamptz,$3))
      order by attempt.attempted_at desc,attempt.id desc limit $4`,
      [visibleScopes, page.sort, page.id, page.fetch]
    );
    return rows(result.rows);
  }
  async manage(context: WriteTransactionContext, input: Parameters<DeviceRepository['manage']>[1]) {
    const database = this.transactions.database(context);
    const result = await this.transactions.database(context).query(
      `insert into verification.device(id,scope_id,label,fingerprint_hash,public_key,status,version)
      values($1,$2,$3,$4,$5,$6,0) on conflict(id) do update set label=excluded.label,fingerprint_hash=excluded.fingerprint_hash,
      public_key=excluded.public_key,status=excluded.status,version=verification.device.version+1
      where verification.device.scope_id=$2 and ($7::bigint is null or verification.device.version=$7) returning id,label,status,version`,
      [input.id, input.scope, input.label, input.fingerprintHash, input.publicKey, input.status, input.expectedVersion]
    );
    if (!result.rows[0]) throw new DomainError('VERSION_CONFLICT');
    return Object.freeze({ ...result.rows[0] });
  }
  async devices(context: ReadTransactionContext, scope: string, page: Parameters<DeviceRepository['devices']>[2]) {
    const database = this.transactions.database(context);
    const result = await this.transactions.database(context).query(
      `select id,label,status,version from verification.device where scope_id=$1
      and ($2::text is null or (label,id)>($2,$3)) order by label,id limit $4`,
      [scope, page.sort, page.id, page.fetch]
    );
    return rows(result.rows);
  }
  private async redeem(context: WriteTransactionContext, database: ReturnType<PgTransactionAccess['database']>, voucher: string, challenge: string, scope: string, actor: string, store: string, trace: string): Promise<string> {
    const accepted = await this.vouchers.redeemVerification(context, { voucher, verification: challenge, scope, actor });
    if (!accepted) throw new DomainError('VOUCHER_REDEMPTION_CONFLICT');
    const organization = await this.organizations.scope(context, scope);
    const scopes = [scope, ...organization.ancestors];
    await new PgRuntimeWriter(database).append({
      id: `event:${randomUUID()}`,
      type: 'voucher.redeemed',
      aggregateType: 'voucher',
      aggregate: voucher,
      scope,
      payload: { voucher, redemption: accepted.id, amountMinor: accepted.amountMinor, currency: 'CNY', mall: scope, store, scopes, timezone: organization.timezone },
      trace,
    });
    return accepted.id;
  }
}
function rows(value: readonly Readonly<Record<string, unknown>>[]) {
  return Object.freeze(value.map((row) => Object.freeze({ ...row })));
}
function required(row: Readonly<Record<string, unknown>> | undefined, code: string) {
  if (!row) throw new Error(code);
  return Object.freeze({ ...row });
}
