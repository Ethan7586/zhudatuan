import type { InvitationRateRule } from '../../domain/policy/InvitationRatePolicy';
import type { WriteTransactionContext } from '../../../../platform/database/TransactionContext';

export interface InvitationRateInput {
  readonly operation: string;
  readonly actor: string;
  readonly trace: string;
  readonly deadline: number;
  readonly signal: AbortSignal;
  readonly rules: readonly InvitationRateRule[];
}

export interface InvitationRatePort {
  consume(input: InvitationRateInput): Promise<void>;
  consumeWithin(context: WriteTransactionContext, input: InvitationRateInput): Promise<void>;
}
