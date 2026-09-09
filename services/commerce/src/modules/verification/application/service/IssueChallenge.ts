import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import type { ChallengeRepository } from '../port/ChallengeRepository';

export interface IssueChallengeInput {
  readonly scope: string;
  readonly membership: string;
  readonly purpose: 'member_code' | 'voucher_redeem';
  readonly voucher: string | null;
  readonly now?: Date;
}

export class IssueChallenge {
  constructor(private readonly challenges: ChallengeRepository) {}

  async execute(context: WriteTransactionContext, input: IssueChallengeInput) {
    const token = randomBytes(32).toString('base64url');
    const session = await this.challenges.issue(context, {
      id: `verification:${randomUUID()}`,
      scope: input.scope,
      membership: input.membership,
      purpose: input.purpose,
      voucher: input.voucher,
      tokenHash: digest(token),
      now: input.now ?? new Date(),
    });
    return Object.freeze({ session, token });
  }
}

function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
