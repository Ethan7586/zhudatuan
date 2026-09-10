import { randomUUID } from 'node:crypto';
import { PgRuntimeWriter } from '../../../../platform/database/PgRuntimeWriter';
import { PgTransactionAccess, type SqlExecutor } from '../../../../platform/database/PgTransactionAccess';
import { DomainError } from '../../../../platform/error/DomainError';
import type { WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import type { MemberAccessPort } from '../../../access/public';
import type { MemberReadPort } from '../../../member/public';
import type { OrganizationReadPort } from '../../../organization/public';
import type { VerificationChannelPort } from '../../../notification/public';
import type { VerificationVoucherPort } from '../../../voucher/public';
import type { ChallengeRepository } from '../../application/port/ChallengeRepository';
import { Challenge } from '../../domain/model/Challenge';
import { VerificationAttempt, type VerificationAttemptResult } from '../../domain/model/VerificationAttempt';
import { VerificationSession, type VerificationSessionValue } from '../../domain/model/VerificationSession';
import { RatePolicy } from '../../domain/policy/RatePolicy';
import { VerificationPolicy } from '../../domain/policy/VerificationPolicy';

import { restore, type SessionRow } from './ChallengeRecord';
import { PgChallengeIssuer } from './PgChallengeIssuer';
export class PgChallengeRepository implements ChallengeRepository {
  private readonly policy = new VerificationPolicy();
  private readonly rates = new RatePolicy();
  private readonly issuer: PgChallengeIssuer;

  constructor(
    private readonly transactions: PgTransactionAccess,
    private readonly members: MemberAccessPort,
    private readonly memberProfiles: MemberReadPort,
    private readonly organizations: OrganizationReadPort,
    private readonly vouchers: VerificationVoucherPort,
    channels: VerificationChannelPort
  ) {
    this.issuer = new PgChallengeIssuer(transactions, members, memberProfiles, vouchers, channels);
  }

  async issue(context: WriteTransactionContext, input: Parameters<ChallengeRepository['issue']>[1]) {
    return this.issuer.issue(context, input);
  }

  async revoke(context: WriteTransactionContext, input: Parameters<ChallengeRepository['revoke']>[1]) {
    const database = this.transactions.database(context);
    const selected = await database.query<SessionRow>(
      `select id,scope_id,subject_type,subject_id,purpose,operation_id,channel,state,attempts::integer,maximum_attempts::integer,
      issued_by,issued_access_version::integer,created_at,expires_at,verified_at,revoked_at,revoke_reason,version::integer
      from verification.session where id=$1 and scope_id=$2 and issued_by=$3 and purpose='member_code' for update`,
      [input.challenge, input.scope, input.membership]
    );
    const row = selected.rows[0];
    if (!row) throw new DomainError('RESOURCE_NOT_FOUND');
    if (row.version !== input.expectedVersion) throw new DomainError('VERSION_CONFLICT');
    const revoked = restore(row).revoke(input.now, 'member_action').snapshot();
    if (revoked.version !== row.version) {
      const changed = await database.query(
        `update verification.session set state=$2,revoked_at=$3,revoke_reason=$4,version=$5
        where id=$1 and version=$6 returning id`,
        [row.id, revoked.state, revoked.revokedAt, revoked.revokeReason, revoked.version, row.version]
      );
      if (!changed.rows[0]) throw new DomainError('VERSION_CONFLICT');
    }
    return sessionView(revoked);
  }

  async verify(context: WriteTransactionContext, input: Parameters<ChallengeRepository['verify']>[1]) {
    const database = this.transactions.database(context);
    const visibleScopes = [input.scope, ...(await this.organizations.scope(context, input.scope)).ancestors];
    const selected = await database.query<SessionRow>(
      `select id,scope_id,subject_type,subject_id,purpose,operation_id,channel,state,attempts::integer,maximum_attempts::integer,
      issued_by,issued_access_version::integer,created_at,expires_at,verified_at,revoked_at,revoke_reason,version::integer from verification.session
      where id=$1 and scope_id=any($2::text[]) for update`,
      [input.challenge, visibleScopes]
    );
    const row = selected.rows[0];
    if (!row) return Object.freeze({ accepted: false as const, status: 409 as const, code: 'VERIFICATION_TOKEN_INVALID' as const });
    const session = restore(row);
    const device = await database.query<{ id: string }>(`select id from verification.device where scope_id=$1 and fingerprint_hash=$2 and status='trusted' for update`, [input.scope, input.deviceHash]);
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
    if (row.purpose === 'member_code' && !(await this.issuerIsCurrent(context, row))) {
      await database.query(
        `update verification.session set state='revoked',revoked_at=$2,revoke_reason='authorization_changed',version=version+1
        where id=$1 and state='issued' and version=$3`,
        [row.id, input.now, row.version]
      );
      await this.attempt(database, row, input, device.rows[0].id, 'rejected', 'authorization_changed');
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
      await database.query(`update verification.session set state=$2,attempts=$3,version=$4 where id=$1 and version=$5`, [row.id, rejected.state, rejected.attempts, rejected.version, row.version]);
      await this.attempt(database, row, input, device.rows[0].id, challenge?.consumed_at ? 'replayed' : 'rejected', 'token_unavailable');
      return Object.freeze({ accepted: false as const, status: 409 as const, code: 'VERIFICATION_TOKEN_INVALID' as const });
    }
    Challenge.restore({ session: row.id, tokenHash: challenge.token_hash, issuedAt: challenge.issued_at, expiresAt: challenge.expires_at, consumedAt: challenge.consumed_at }).consume(input.now);
    const verified = session.verify(input.now).snapshot();
    const changed = await database.query(`update verification.session set state=$2,attempts=$3,verified_at=$4,version=$5 where id=$1 and state='issued' and version=$6 returning id`, [
      row.id,
      verified.state,
      verified.attempts,
      verified.verifiedAt,
      verified.version,
      row.version,
    ]);
    if (!changed.rows[0]) throw new DomainError('VERIFICATION_TOKEN_INVALID');
    await database.query(
      `update verification.token set consumed_at=$3,consumed_by_device_id=$4,consumed_by_actor_id=$5
      where session_id=$1 and token_hash=$2 and consumed_at is null`,
      [row.id, input.tokenHash, input.now, device.rows[0].id, input.actor]
    );
    await database.query(`update verification.device set last_used_at=$2,version=version+1 where id=$1`, [device.rows[0].id, input.now]);
    const record = row.purpose === 'voucher_redeem' ? await this.redeem(context, row.subject_id, row.id, row.scope_id, input.actor, input.scope) : `verificationrecord:${row.id}`;
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
      id: `event:verification:${row.id}`,
      type: 'verification.completed',
      aggregateType: 'verification',
      aggregate: row.id,
      scope: row.scope_id,
      payload: { verification: row.id, subjectType: row.subject_type, subject: row.subject_id, purpose: row.purpose, operation: row.operation_id, record },
      trace: input.trace,
    });
    return Object.freeze({ accepted: true as const, value: Object.freeze({ record, verified: true, subjectType: row.subject_type, subject: row.subject_id, purpose: row.purpose, operation: row.operation_id, proofExpiresAt }) });
  }

  private async issuerIsCurrent(context: WriteTransactionContext, row: SessionRow): Promise<boolean> {
    try {
      const profile = await this.members.profile(context, row.issued_by);
      if (profile.member !== row.subject_id || profile.organization !== row.scope_id || profile.accessversion !== row.issued_access_version) return false;
      const member = await this.memberProfiles.summary(context, profile.member, profile.organization);
      return member?.status === 'active' && member.mobileMasked !== null;
    } catch (cause) {
      if (cause instanceof DomainError && cause.code === 'MEMBERSHIP_SELECTION_REQUIRED') return false;
      throw cause;
    }
  }

  private async attempt(database: SqlExecutor, session: SessionRow, input: Parameters<ChallengeRepository['verify']>[1], device: string | null, result: VerificationAttemptResult, reason: string): Promise<void> {
    const sequence = await database.query<{ value: number }>(`select coalesce(max(sequence),0)::integer+1 value from verification.attempt where session_id=$1`, [session.id]);
    const attempt = new VerificationAttempt({
      id: `attempt:${randomUUID()}`,
      session: session.id,
      sequence: sequence.rows[0]?.value ?? 1,
      scope: session.scope_id,
      purpose: session.purpose,
      operation: session.operation_id,
      actor: input.actor,
      device,
      result,
      reason,
      trace: input.trace,
      attemptedAt: input.now,
    }).value;
    await database.query(
      `insert into verification.attempt(id,session_id,sequence,scope_id,purpose,operation_id,actor_id,token_hash,device_id,result,reason,evidence,trace_id,attempted_at)
      values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'{}'::jsonb,$12,$13)`,
      [attempt.id, attempt.session, attempt.sequence, attempt.scope, attempt.purpose, attempt.operation, attempt.actor, input.tokenHash, attempt.device, attempt.result, attempt.reason, attempt.trace, attempt.attemptedAt]
    );
  }

  private async redeem(context: WriteTransactionContext, voucher: string, challenge: string, scope: string, actor: string, store: string): Promise<string> {
    const accepted = await this.vouchers.redeemVerification(context, { voucher, verification: challenge, scope, store, actor });
    if (!accepted) throw new DomainError('VOUCHER_REDEMPTION_CONFLICT');
    return accepted.id;
  }
}

function sessionView(value: VerificationSessionValue) {
  return Object.freeze({
    id: value.id,
    subject_type: value.subjectType,
    subject_id: value.subject,
    purpose: value.purpose,
    operation_id: value.operation,
    channel: value.channel,
    state: value.state,
    attempts: value.attempts,
    maximum_attempts: value.maximumAttempts,
    issued_at: value.createdAt,
    expires_at: value.expiresAt,
    verified_at: value.verifiedAt,
    version: value.version,
  });
}
