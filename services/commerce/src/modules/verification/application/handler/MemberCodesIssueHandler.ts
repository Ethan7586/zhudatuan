import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import { requireSession } from '../../../../platform/security/OperationSecurityContext';
import type { ChallengeRepository } from '../port/ChallengeRepository';
import { IssueChallenge } from '../service/IssueChallenge';

export class MemberCodesIssueHandler implements OperationHandler<'verification.membercodes.issue', 'write'> {
  readonly operation = 'verification.membercodes.issue' as const;
  readonly mode = 'write' as const;
  private readonly issue: IssueChallenge;

  constructor(challenges: ChallengeRepository) {
    this.issue = new IssueChallenge(challenges);
  }

  async execute(_input: OperationInputFor<'verification.membercodes.issue'>, context: WriteHandlerContext<'verification.membercodes.issue'>): Promise<OperationReply<OperationOutputFor<'verification.membercodes.issue'>>> {
    const access = requireSession(context.security);
    const result = await this.issue.execute(context.transaction, {
      scope: access.scope.id,
      membership: access.membership.id,
      purpose: 'member_code',
      voucher: null,
    });
    return {
      status: 201,
      body: memberCode(result.session, result.token) as OperationOutputFor<'verification.membercodes.issue'>,
    };
  }
}

function memberCode(session: Awaited<ReturnType<IssueChallenge['execute']>>['session'], token: string) {
  return Object.freeze({
    id: session.id,
    state: 'issued' as const,
    issued_at: session.issued_at.toISOString(),
    expires_at: session.expires_at.toISOString(),
    version: session.version,
    token,
  });
}
