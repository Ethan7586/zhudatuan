export type RiskCaseState = 'open' | 'reviewing' | 'cleared' | 'confirmed' | 'closed';

export class RiskCase {
  constructor(readonly id: string, readonly state: RiskCaseState, readonly decisionActor: string | null) {
    if (!id) throw new Error('RISK_CASE_INVALID');
  }

  review(action: 'accept' | 'clear' | 'confirm' | 'close', reviewer: string): RiskCaseState {
    if (!reviewer || reviewer === this.decisionActor) throw new Error('RISK_CASE_REVIEWER_SEPARATION_REQUIRED');
    if (action === 'accept' && this.state === 'open') return 'reviewing';
    if (action === 'clear' && (this.state === 'open' || this.state === 'reviewing')) return 'cleared';
    if (action === 'confirm' && (this.state === 'open' || this.state === 'reviewing')) return 'confirmed';
    if (action === 'close' && (this.state === 'cleared' || this.state === 'confirmed')) return 'closed';
    throw new Error('RISK_CASE_TRANSITION_INVALID');
  }
}
