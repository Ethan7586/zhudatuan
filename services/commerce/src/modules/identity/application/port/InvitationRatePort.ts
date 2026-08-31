import type { InvitationRateRule } from '../../domain/policy/InvitationRatePolicy';

export interface InvitationRatePort {
  consume(input: Readonly<{ operation: string; actor: string; trace: string; rules: readonly InvitationRateRule[] }>): Promise<void>;
}
