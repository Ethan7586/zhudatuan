export interface BenefitLot {
  readonly id: string;
  readonly batch: string;
  readonly totalMinor: number;
  readonly remainingMinor: number;
  readonly state: string;
  readonly effectiveAt: string;
  readonly expiresAt: string | null;
}

export interface BenefitAccount {
  readonly id: string;
  readonly kind: BenefitAccountDto['kind'];
  readonly currency: string;
  readonly status: BenefitAccountDto['status'];
  readonly balanceMinor: number;
  readonly frozenMinor: number;
  readonly availableMinor: number;
  readonly lots: readonly BenefitLot[];
}
import type { OperationOutputFor } from '@shop/contract';

type BenefitAccountDto = OperationOutputFor<'benefit.accounts.read'>['items'][number];
