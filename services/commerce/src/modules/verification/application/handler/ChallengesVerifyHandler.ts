import { createHash } from 'node:crypto';
import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import { bodyRecord, textField } from '../../../../foundation/interface/Validation';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
import type { ChallengeRepository } from '../port/ChallengeRepository';

export class ChallengesVerifyHandler implements OperationHandler<'verification.challenges.verify', 'write'> {
  readonly operation = 'verification.challenges.verify' as const;
  readonly mode = 'write' as const;
  constructor(private readonly challenges: ChallengeRepository) {}
  async execute(input: OperationInputFor<'verification.challenges.verify'>, context: WriteHandlerContext<'verification.challenges.verify'>): Promise<OperationReply<OperationOutputFor<'verification.challenges.verify'>>> {
    const access = requireSession(context.security);
    const body = bodyRecord(input);
    const result = await this.challenges.verify(context.transaction, {
      challenge: input.path.challengeid,
      scope: access.scope.id,
      actor: access.actor.id,
      trace: access.trace,
      nonceHash: digest(textField(body, 'nonce', 256)),
      deviceHash: digest(textField(body, 'device', 512)),
    });
    return { status: 200, body: result as OperationOutputFor<'verification.challenges.verify'> };
  }
}
function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
