import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import { bodyRecord, textField } from '../../../../foundation/interface/Validation';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
import type { ChallengeRepository } from '../port/ChallengeRepository';

export class ChallengesIssueHandler implements OperationHandler<'verification.challenges.issue', 'write'> {
  readonly operation = 'verification.challenges.issue' as const;
  readonly mode = 'write' as const;
  constructor(private readonly challenges: ChallengeRepository) {}
  async execute(input: OperationInputFor<'verification.challenges.issue'>, context: WriteHandlerContext<'verification.challenges.issue'>): Promise<OperationReply<OperationOutputFor<'verification.challenges.issue'>>> {
    const access = requireSession(context.security);
    const body = bodyRecord(input);
    const purpose = purposeField(body.purpose);
    const nonce = randomBytes(32).toString('base64url');
    const result = await this.challenges.issue(context.transaction, {
      id: `verification:${randomUUID()}`,
      scope: access.scope.id,
      membership: access.membership.id,
      purpose,
      voucher: purpose === 'voucher_redeem' ? textField(body, 'voucher') : null,
      nonceHash: digest(nonce),
    });
    return { status: 201, body: { ...result, nonce } as OperationOutputFor<'verification.challenges.issue'> };
  }
}

function purposeField(value: unknown): 'member_code' | 'voucher_redeem' {
  if (value === undefined || value === 'member_code') return 'member_code';
  if (value === 'voucher_redeem') return 'voucher_redeem';
  throw new Error('VERIFICATION_PURPOSE_UNSUPPORTED');
}
function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
