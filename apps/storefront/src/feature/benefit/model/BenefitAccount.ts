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
  readonly kind: 'welfare' | 'meal' | 'allowance';
  readonly currency: string;
  readonly status: 'active' | 'frozen' | 'closed';
  readonly balanceMinor: number;
  readonly frozenMinor: number;
  readonly availableMinor: number;
  readonly lots: readonly BenefitLot[];
}
