import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import { DomainError } from '../../../../platform/error/DomainError';
import { requireSession } from '../../../../platform/security/OperationSecurityContext';
import type { ChallengeRepository } from '../port/ChallengeRepository';

export class MemberCodesRevokeHandler implements OperationHandler<'verification.membercodes.revoke', 'write'> {
  readonly operation = 'verification.membercodes.revoke' as const;
  readonly mode = 'write' as const;

  constructor(private readonly challenges: ChallengeRepository) {}

  async execute(input: OperationInputFor<'verification.membercodes.revoke'>, context: WriteHandlerContext<'verification.membercodes.revoke'>): Promise<OperationReply<OperationOutputFor<'verification.membercodes.revoke'>>> {
    const access = requireSession(context.security);
    if (context.expectedVersion === undefined) throw new DomainError('EXPECTED_VERSION_REQUIRED');
    const session = await this.challenges.revoke(context.transaction, {
      challenge: input.path.challengeid,
      scope: access.scope.id,
      membership: access.membership.id,
      expectedVersion: context.expectedVersion,
      now: new Date(),
    });
    if (session.state !== 'issued' && session.state !== 'expired' && session.state !== 'revoked') throw new DomainError('VERIFICATION_TOKEN_INVALID');
    return {
      status: 200,
      body: Object.freeze({
        id: session.id,
        state: session.state,
        issued_at: session.issued_at.toISOString(),
        expires_at: session.expires_at.toISOString(),
        version: session.version,
      }),
    };
  }
}
