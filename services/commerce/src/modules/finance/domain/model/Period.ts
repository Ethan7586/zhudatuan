export type PeriodState = 'open' | 'closing' | 'closed';
export type PeriodCloseState = 'pending' | 'approved' | 'rejected';

export interface Period {
  readonly scope: string;
  readonly period: string;
  readonly state: PeriodState;
  readonly closeState: PeriodCloseState | null;
  readonly sourceHash: string | null;
}
