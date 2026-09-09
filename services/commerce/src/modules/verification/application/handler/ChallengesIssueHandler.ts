import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import { bodyRecord, textField } from '../../../../pipeline/Validation';
import { requireSession } from '../../../../platform/security/OperationSecurityContext';
import type { ChallengeRepository } from '../port/ChallengeRepository';
import { IssueChallenge } from '../service/IssueChallenge';

export class ChallengesIssueHandler implements OperationHandler<'verification.challenges.issue', 'write'> {
  readonly operation = 'verification.challenges.issue' as const;
  readonly mode = 'write' as const;
  private readonly issue: IssueChallenge;
  constructor(challenges: ChallengeRepository) {
    this.issue = new IssueChallenge(challenges);
  }
  async execute(input: OperationInputFor<'verification.challenges.issue'>, context: WriteHandlerContext<'verification.challenges.issue'>): Promise<OperationReply<OperationOutputFor<'verification.challenges.issue'>>> {
    const access = requireSession(context.security);
    const body = bodyRecord(input);
    const purpose = purposeField(body.purpose);
    const result = await this.issue.execute(context.transaction, {
      scope: access.scope.id,
      membership: access.membership.id,
      purpose,
      voucher: purpose === 'voucher_redeem' ? textField(body, 'voucher') : null,
    });
    const { issued_at: _issuedAt, expires_at: expiresAt, verified_at: verifiedAt, ...session } = result.session;
    return {
      status: 201,
      body: {
        ...session,
        expires_at: expiresAt.toISOString(),
        verified_at: verifiedAt?.toISOString() ?? null,
        token: result.token,
      },
    };
  }
}

function purposeField(value: unknown): 'member_code' | 'voucher_redeem' {
  if (value === undefined || value === 'member_code') return 'member_code';
  if (value === 'voucher_redeem') return 'voucher_redeem';
  throw new Error('VERIFICATION_PURPOSE_UNSUPPORTED');
}
