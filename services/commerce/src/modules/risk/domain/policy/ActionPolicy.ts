import type { RiskActionProposal, RiskActionTarget } from '../model/RiskAction';
import type { RiskOutcome } from '../model/RiskPolicy';

export interface ActionContext {
  readonly actor: string;
  readonly operation: string;
  readonly resource: string | null;
  readonly outcome: RiskOutcome;
}

/** The only place where a risk result may be translated into a cross-domain action request. */
export class ActionPolicy {
  propose(input: ActionContext): RiskActionProposal | null {
    if (input.outcome === 'allow') return null;
    const target = this.target(input);
    if (input.outcome === 'challenge' || input.outcome === 'review') {
      return Object.freeze({ kind: 'requireverification', target, approvalRequired: false, rationale: `risk.${input.outcome}` });
    }
    if (target.module === 'finance' || target.module === 'payment') {
      return Object.freeze({ kind: 'blocksettlement', target, approvalRequired: true, rationale: 'risk.deny.finance' });
    }
    if (target.module === 'catalog') {
      return Object.freeze({ kind: 'suggestunlist', target, approvalRequired: true, rationale: 'risk.deny.catalog' });
    }
    if (target.module === 'voucher') {
      return Object.freeze({ kind: 'pausesales', target, approvalRequired: true, rationale: 'risk.deny.voucher' });
    }
    return Object.freeze({ kind: 'requireverification', target, approvalRequired: false, rationale: 'risk.deny.identity' });
  }

  private target(input: ActionContext): RiskActionTarget {
    const owner = input.operation.split('.')[0];
    const module = owner === 'catalog' ? 'catalog' : owner === 'finance' ? 'finance' : owner === 'payment' ? 'payment' : owner === 'voucher' ? 'voucher' : 'identity';
    return Object.freeze({ module, type: input.resource === null ? 'actor' : 'resource', id: input.resource ?? input.actor });
  }
}
