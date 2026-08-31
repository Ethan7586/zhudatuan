export interface BenefitEntry {
  readonly id: string;
  readonly account: string;
  readonly kind: string;
  readonly currency: string;
  readonly amountMinor: number;
  readonly referenceType: string;
  readonly referenceId: string;
  readonly description: string;
  readonly occurredAt: string;
}

export interface BenefitCenter {
  readonly accounts: readonly BenefitAccount[];
  readonly ledger: readonly BenefitEntry[];
}
import type { BenefitAccount } from './BenefitAccount';
