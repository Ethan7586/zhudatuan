import type { WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import { PgTransactionAccess } from '../../../../platform/database/PgTransactionAccess';
import { DomainError } from '../../../../platform/error/DomainError';
import type { MemberAccessPort } from '../../../access/public';
import type { MemberReadPort } from '../../../member/public';
import type { VerificationChannelPort } from '../../../notification/public';
import type { VerificationVoucherPort } from '../../../voucher/public';
import type { ChallengeRepository } from '../../application/port/ChallengeRepository';
import { Challenge } from '../../domain/model/Challenge';
import { VerificationSession, type VerificationSessionValue } from '../../domain/model/VerificationSession';
import { RatePolicy } from '../../domain/policy/RatePolicy';
import { VerificationPolicy } from '../../domain/policy/VerificationPolicy';

export class PgChallengeIssuer {
  private readonly policy = new VerificationPolicy();
  private readonly rates = new RatePolicy();

  constructor(
    private readonly transactions: PgTransactionAccess,
    private readonly members: MemberAccessPort,
    private readonly memberProfiles: MemberReadPort,
    private readonly vouchers: VerificationVoucherPort,
    private readonly channels: VerificationChannelPort
  ) {}

  async issue(context: WriteTransactionContext, input: Parameters<ChallengeRepository['issue']>[1]) {
    const database = this.transactions.database(context);
    const profile = await this.members.profile(context, input.membership);
    if (input.purpose === 'member_code') {
      const member = await this.memberProfiles.summary(context, profile.member, profile.organization);
      if (!member || member.status !== 'active') throw new DomainError('VERIFICATION_MEMBER_INACTIVE');
      if (member.mobileMasked === null) throw new DomainError('VERIFICATION_MOBILE_REQUIRED');
    }
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
    if (input.purpose === 'member_code') {
      await database.query(
        `update verification.session set state='revoked',revoked_at=$2,revoke_reason='refreshed',version=version+1
        where issued_by=$1 and purpose='member_code' and state='issued'`,
        [input.membership, input.now]
      );
    }
    const expiresAt = new Date(input.now.getTime() + rule.ttlSeconds * 1000);
    const session = VerificationSession.issue({
      id: input.id,
      scope,
      subjectType,
      subject,
      purpose: input.purpose,
      operation: rule.operation,
      channel: rule.channel,
      maximumAttempts: rule.maximumAttempts,
      issuedBy: input.membership,
      issuedAccessVersion: profile.accessversion,
      createdAt: input.now,
      expiresAt,
    });
    const token = Challenge.issue({ session: input.id, tokenHash: input.tokenHash, issuedAt: input.now, expiresAt });
    const value = session.snapshot();
    await database.query(
      `with session as (insert into verification.session(id,scope_id,subject_type,subject_id,purpose,operation_id,channel,state,attempts,
      maximum_attempts,issued_by,issued_access_version,created_at,expires_at,verified_at,revoked_at,revoke_reason,version)
      values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,null,null,null,$15)
      returning id,subject_type,subject_id,purpose,operation_id,channel,state,attempts,maximum_attempts,expires_at,verified_at,version),
      token as (insert into verification.token(session_id,token_hash,issued_at,expires_at,consumed_at,consumed_by_device_id,consumed_by_actor_id)
      values($1,$16,$13,$14,null,null,null)) select session.id from session`,
      [
        value.id,
        value.scope,
        value.subjectType,
        value.subject,
        value.purpose,
        value.operation,
        value.channel,
        value.state,
        value.attempts,
        value.maximumAttempts,
        value.issuedBy,
        value.issuedAccessVersion,
        value.createdAt,
        value.expiresAt,
        value.version,
        token.snapshot().tokenHash,
      ]
    );
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
      verified_at: null,
      version: value.version,
    });
  }
}
