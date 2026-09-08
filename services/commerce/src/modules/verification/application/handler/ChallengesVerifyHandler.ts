import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import { bodyRecord, textField } from '../../../../pipeline/Validation';
import { requireSession } from '../../../../platform/security/OperationSecurityContext';
import type { ChallengeRepository } from '../port/ChallengeRepository';

export class ChallengesVerifyHandler implements OperationHandler<'verification.challenges.verify', 'write'> {
  readonly operation = 'verification.challenges.verify' as const;
  readonly mode = 'write' as const;
  constructor(private readonly challenges: ChallengeRepository) {}
  async execute(input: OperationInputFor<'verification.challenges.verify'>, context: WriteHandlerContext<'verification.challenges.verify'>): Promise<OperationReply<OperationOutputFor<'verification.challenges.verify'>>> {
    const access = requireSession(context.security);
    const body = bodyRecord(input);
    const proof = randomBytes(32).toString('base64url');
    const result = await this.challenges.verify(context.transaction, {
      challenge: input.path.challengeid,
      scope: access.scope.id,
      actor: access.actor.id,
      trace: access.trace,
      tokenHash: digest(textField(body, 'token', 256)),
      proofId: `verificationproof:${randomUUID()}`,
      proofHash: digest(proof),
      deviceHash: digest(textField(body, 'device', 512)),
      now: new Date(),
    });
    if (!result.accepted) return { status: result.status, body: { code: result.code } } as never;
    return { status: 200, body: { ...result.value, proof } as OperationOutputFor<'verification.challenges.verify'> };
  }
}
function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
