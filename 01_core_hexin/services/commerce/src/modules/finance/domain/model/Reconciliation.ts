export type ReconciliationState = 'received' | 'matching' | 'balanced' | 'difference' | 'resolved' | 'approved';
export type ReconciliationItemState = 'matched' | 'difference' | 'resolutionpending' | 'resolved';

export interface Reconciliation {
  readonly id: string;
  readonly scope: string;
  readonly provider: string;
  readonly partner: string;
  readonly period: string;
  readonly statementHash: string;
  readonly differenceMinor: number;
  readonly state: ReconciliationState;
  readonly version: number;
}
