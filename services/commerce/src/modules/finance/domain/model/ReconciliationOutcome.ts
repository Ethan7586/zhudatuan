export interface ReconciliationOutcome {
  readonly id: string;
  readonly scopeId: string;
  readonly makerId: string;
  readonly statementHash: string;
  readonly externalMinor: number;
  readonly internalMinor: number;
  readonly differenceMinor: number;
  readonly differenceCount: number;
  readonly maximumDifferenceMinor: number;
  readonly thresholdMinor: number;
  readonly version: number;
  readonly state: 'balanced' | 'difference';
}
