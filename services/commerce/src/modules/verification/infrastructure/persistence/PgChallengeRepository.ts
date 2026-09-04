import { randomUUID } from 'node:crypto';
import { PgRuntimeWriter } from '../../../../adapter/database/PgRuntimeWriter';
import { PgTransactionAccess, type SqlExecutor } from '../../../../adapter/database/PgTransactionAccess';
import { DomainError } from '../../../../foundation/domain/DomainError';
import type { WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { MemberAccessPort } from '../../../access/public';
import type { OrganizationReadPort } from '../../../organization/public';
import type { VerificationChannelPort } from '../../../notification/public';
import type { VerificationVoucherPort } from '../../../voucher/public';
import type { ChallengeRepository } from '../../application/port/ChallengeRepository';
import { Challenge } from '../../domain/model/Challenge';
import { VerificationAttempt, type VerificationAttemptResult } from '../../domain/model/VerificationAttempt';
import { VerificationSession, type VerificationPurpose, type VerificationSessionValue } from '../../domain/model/VerificationSession';
import { RatePolicy } from '../../domain/policy/RatePolicy';
import { VerificationPolicy } from '../../domain/policy/VerificationPolicy';

interface SessionRow {
  readonly id: string;
  readonly scope_id: string;
  readonly subject_type: VerificationSessionValue['subjectType'];
  readonly subject_id: string;
  readonly purpose: VerificationPurpose;
  readonly operation_id: string;
  readonly channel: VerificationSessionValue['channel'];
  readonly state: VerificationSessionValue['state'];
  readonly attempts: number;
  readonly maximum_attempts: number;
  readonly issued_by: string;
  readonly created_at: Date;
  readonly expires_at: Date;
  readonly verified_at: Date | null;
  readonly version: number;
}

export class PgChallengeRepository implements ChallengeRepository {
  private readonly policy = new VerificationPolicy();
  private readonly rates = new RatePolicy();

  constructor(
    private readonly transactions: PgTransactionAccess,
    private readonly members: MemberAccessPort,
    private readonly organizations: OrganizationReadPort,
    private readonly vouchers: VerificationVoucherPort,
    private readonly channels: VerificationChannelPort
  ) {}

  async issue(context: WriteTransactionContext, input: Parameters<ChallengeRepository['issue']>[1]) {
    const database = this.transactions.database(context);
    const profile = await this.members.profile(context, input.membership);
    const rule = this.policy.resolve(input.purpose);
    this.channels.require(rule.channel);
    let subjectType: VerificationSessionValue['subjectType'] = 'member';
    let subject = profile.member;
    let scope = profile.organization;
    if (input.purpose === 'voucher_redeem') {
      if (!input.voucher) throw new DomainError('VOUCHER_NOT_REDEEMABLE');
      subjectType = 'voucher';
      subject = input.voucher;
      const voucherScope = await this.vouchers.redeemableScope(context, subject, profile.member);
      if (!voucherScope) throw new DomainError('VOUCHER_NOT_REDEEMABLE');
      scope = voucherScope;
    }
    await database.query('select pg_advisory_xact_lock(hashtextextended($1,0))', [`verification:issue:${input.membership}:${input.purpose}`]);
    const frequency = await database.query<{ count: number; last_issued_at: Date | null }>(
      `select count(*)::integer count,max(created_at) last_issued_at from verification.session
      where issued_by=$1 and purpose=$2 and created_at>$3::timestamptz-interval '1 minute'`,
      [input.membership, input.purpose, input.now]
    );
    this.rates.issue({ count: frequency.rows[0]?.count ?? 0, lastIssuedAt: frequency.rows[0]?.last_issued_at ?? null, now: input.now });
    const expiresAt = new Date(input.now.getTime() + rule.ttlSeconds * 1000);
    const session = VerificationSession.issue({ id: input.id, scope, subjectType, subject, purpose: input.purpose, operation: rule.operation,
      channel: rule.channel, maximumAttempts: rule.maximumAttempts, issuedBy: input.membership, createdAt: input.now, expiresAt });
    const token = Challenge.issue({ session: input.id, tokenHash: input.tokenHash, issuedAt: input.now, expiresAt });
    const value = session.snapshot();
    await database.query(
      `with session as (insert into verification.session(id,scope_id,subject_type,subject_id,purpose,operation_id,channel,state,attempts,
      maximum_attempts,issued_by,created_at,expires_at,verified_at,version)
      values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,null,$14)
      returning id,subject_type,subject_id,purpose,operation_id,channel,state,attempts,maximum_attempts,expires_at,verified_at,version),
      token as (insert into verification.token(session_id,token_hash,issued_at,expires_at,consumed_at,consumed_by_device_id,consumed_by_actor_id)
      values($1,$15,$12,$13,null,null,null)) select session.id from session`,
      [value.id, value.scope, value.subjectType, value.subject, value.purpose, value.operation, value.channel, value.state, value.attempts,
        value.maximumAttempts, value.issuedBy, value.createdAt, value.expiresAt, value.version, token.snapshot().tokenHash]
    );
    return Object.freeze({ id: value.id, subject_type: value.subjectType, subject_id: value.subject, purpose: value.purpose,
      operation_id: value.operation, channel: value.channel, state: value.state, attempts: value.attempts, maximum_attempts: value.maximumAttempts,
      expires_at: value.expiresAt, verified_at: null, version: value.version });
  }

  async verify(context: WriteTransactionContext, input: Parameters<ChallengeRepository['verify']>[1]) {
    const database = this.transactions.database(context);
    const visibleScopes = [input.scope, ...(await this.organizations.scope(context, input.scope)).ancestors];
    const selected = await database.query<SessionRow>(
      `select id,scope_id,subject_type,subject_id,purpose,operation_id,channel,state,attempts::integer,maximum_attempts::integer,
      issued_by,created_at,expires_at,verified_at,version::integer from verification.session
      where id=$1 and scope_id=any($2::text[]) for update`,
      [input.challenge, visibleScopes]
    );
    const row = selected.rows[0];
    if (!row) return Object.freeze({ accepted: false as const, status: 409 as const, code: 'VERIFICATION_TOKEN_INVALID' as const });
    const session = restore(row);
    const device = await database.query<{ id: string }>(
      `select id from verification.device where scope_id=$1 and fingerprint_hash=$2 and status='trusted' for update`,
      [input.scope, input.deviceHash]
    );
    if (!device.rows[0]) {
      await this.attempt(database, row, input, null, 'rejected', 'device_denied');
      return Object.freeze({ accepted: false as const, status: 403 as const, code: 'VERIFICATION_DEVICE_DENIED' as const });
    }
    if (row.state === 'locked' || row.attempts >= row.maximum_attempts) {
      await this.attempt(database, row, input, device.rows[0].id, 'rejected', 'attempt_limit');
      return Object.freeze({ accepted: false as const, status: 429 as const, code: 'RATE_LIMITED' as const });
    }
    if (row.state !== 'issued' || row.expires_at <= input.now) {
      if (row.state === 'issued') await database.query(`update verification.session set state='expired',version=version+1 where id=$1 and version=$2`, [row.id, row.version]);
      await this.attempt(database, row, input, device.rows[0].id, row.expires_at <= input.now ? 'expired' : 'replayed', 'token_unavailable');
      return Object.freeze({ accepted: false as const, status: 409 as const, code: 'VERIFICATION_TOKEN_INVALID' as const });
    }
    this.rates.verify(row.attempts, row.maximum_attempts);
    const token = await database.query<{ token_hash: string; issued_at: Date; expires_at: Date; consumed_at: Date | null }>(
      `select token_hash,issued_at,expires_at,consumed_at from verification.token where session_id=$1 and token_hash=$2 for update`,
      [row.id, input.tokenHash]
    );
    const challenge = token.rows[0];
    if (!challenge || challenge.consumed_at !== null || challenge.expires_at <= input.now) {
      const rejected = session.reject(input.now).snapshot();
      await database.query(`update verification.session set state=$2,attempts=$3,version=$4 where id=$1 and version=$5`,
        [row.id, rejected.state, rejected.attempts, rejected.version, row.version]);
      await this.attempt(database, row, input, device.rows[0].id, challenge?.consumed_at ? 'replayed' : 'rejected', 'token_unavailable');
      return Object.freeze({ accepted: false as const, status: 409 as const, code: 'VERIFICATION_TOKEN_INVALID' as const });
    }
    Challenge.restore({ session: row.id, tokenHash: challenge.token_hash, issuedAt: challenge.issued_at, expiresAt: challenge.expires_at, consumedAt: challenge.consumed_at }).consume(input.now);
    const verified = session.verify(input.now).snapshot();
    const changed = await database.query(
      `update verification.session set state=$2,attempts=$3,verified_at=$4,version=$5 where id=$1 and state='issued' and version=$6 returning id`,
      [row.id, verified.state, verified.attempts, verified.verifiedAt, verified.version, row.version]
    );
    if (!changed.rows[0]) throw new DomainError('VERIFICATION_TOKEN_INVALID');
    await database.query(
      `update verification.token set consumed_at=$3,consumed_by_device_id=$4,consumed_by_actor_id=$5
      where session_id=$1 and token_hash=$2 and consumed_at is null`,
      [row.id, input.tokenHash, input.now, device.rows[0].id, input.actor]
    );
    await database.query(`update verification.device set last_used_at=$2,version=version+1 where id=$1`, [device.rows[0].id, input.now]);
    const record = row.purpose === 'voucher_redeem'
      ? await this.redeem(context, row.subject_id, row.id, row.scope_id, input.actor, input.scope)
      : `verificationrecord:${row.id}`;
    const rule = this.policy.resolve(row.purpose, row.operation_id);
    const proofExpiresAt = new Date(input.now.getTime() + rule.proofSeconds * 1000);
    await database.query(
      `insert into verification.proof(id,session_id,proof_hash,scope_id,subject_type,subject_id,purpose,operation_id,state,
      issued_at,expires_at,consumed_at,consumed_by,version)
      values($1,$2,$3,$4,$5,$6,$7,$8,'active',$9,$10,null,null,0)`,
      [input.proofId, row.id, input.proofHash, row.scope_id, row.subject_type, row.subject_id, row.purpose, row.operation_id, input.now, proofExpiresAt]
    );
    await this.attempt(database, row, input, device.rows[0].id, 'accepted', 'verified');
    await new PgRuntimeWriter(database).append({
      id: `event:verification:${row.id}`, type: 'verification.completed', aggregateType: 'verification', aggregate: row.id, scope: row.scope_id,
      payload: { verification: row.id, subjectType: row.subject_type, subject: row.subject_id, purpose: row.purpose, operation: row.operation_id, record }, trace: input.trace,
    });
    return Object.freeze({ accepted: true as const, value: Object.freeze({ record, verified: true, subjectType: row.subject_type, subject: row.subject_id,
      purpose: row.purpose, operation: row.operation_id, proofExpiresAt }) });
  }

  private async attempt(
    database: SqlExecutor,
    session: SessionRow,
    input: Parameters<ChallengeRepository['verify']>[1],
    device: string | null,
    result: VerificationAttemptResult,
    reason: string
  ): Promise<void> {
    const sequence = await database.query<{ value: number }>(`select coalesce(max(sequence),0)::integer+1 value from verification.attempt where session_id=$1`, [session.id]);
    const attempt = new VerificationAttempt({ id: `attempt:${randomUUID()}`, session: session.id, sequence: sequence.rows[0]?.value ?? 1,
      scope: session.scope_id, purpose: session.purpose, operation: session.operation_id, actor: input.actor, device, result, reason,
      trace: input.trace, attemptedAt: input.now }).value;
    await database.query(
      `insert into verification.attempt(id,session_id,sequence,scope_id,purpose,operation_id,actor_id,token_hash,device_id,result,reason,evidence,trace_id,attempted_at)
      values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'{}'::jsonb,$12,$13)`,
      [attempt.id, attempt.session, attempt.sequence, attempt.scope, attempt.purpose, attempt.operation, attempt.actor, input.tokenHash,
        attempt.device, attempt.result, attempt.reason, attempt.trace, attempt.attemptedAt]
    );
  }

  private async redeem(context: WriteTransactionContext, voucher: string, challenge: string, scope: string, actor: string, store: string): Promise<string> {
    const accepted = await this.vouchers.redeemVerification(context, { voucher, verification: challenge, scope, store, actor });
    if (!accepted) throw new DomainError('VOUCHER_REDEMPTION_CONFLICT');
    return accepted.id;
  }
}

function restore(row: SessionRow): VerificationSession {
  return VerificationSession.restore({ id: row.id, scope: row.scope_id, subjectType: row.subject_type, subject: row.subject_id,
    purpose: row.purpose, operation: row.operation_id, channel: row.channel, state: row.state, attempts: row.attempts,
    maximumAttempts: row.maximum_attempts, issuedBy: row.issued_by, createdAt: row.created_at, expiresAt: row.expires_at,
    verifiedAt: row.verified_at, version: row.version });
}
