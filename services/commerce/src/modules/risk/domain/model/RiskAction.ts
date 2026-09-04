export const RISK_ACTION_KINDS = ['blocksettlement', 'requireverification', 'pausesales', 'suggestunlist'] as const;
export type RiskActionKind = (typeof RISK_ACTION_KINDS)[number];
export type RiskActionState = 'proposed' | 'approvalrequired' | 'approved' | 'applied' | 'rejected' | 'expired';

export interface RiskActionTarget {
  readonly module: 'catalog' | 'finance' | 'payment' | 'voucher' | 'identity';
  readonly type: string;
  readonly id: string;
}

export interface RiskActionProposal {
  readonly kind: RiskActionKind;
  readonly target: RiskActionTarget;
  readonly approvalRequired: boolean;
  readonly rationale: string;
}

export class RiskAction {
  readonly kind: RiskActionKind;
  readonly target: RiskActionTarget;
  readonly state: RiskActionState;

  constructor(
    readonly id: string,
    readonly decision: string,
    proposal: RiskActionProposal,
    state: RiskActionState
  ) {
    if (!id || !decision || !RISK_ACTION_KINDS.includes(proposal.kind) || !proposal.target.id || !proposal.rationale) throw new Error('RISK_ACTION_INVALID');
    if (proposal.approvalRequired && state === 'proposed') throw new Error('RISK_ACTION_APPROVAL_REQUIRED');
    this.kind = proposal.kind;
    this.target = Object.freeze({ ...proposal.target });
    this.state = state;
    Object.freeze(this);
  }
}
