export type BenefitPlanState = 'draft' | 'active' | 'paused' | 'retired';
export type GrantBatchState = 'submitted' | 'approved' | 'rejected' | 'scheduled' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled' | 'revoking' | 'revoked';
export type GrantControl = 'pause' | 'resume' | 'cancel';

const planTransitions = {
  draft: ['draft', 'active', 'retired'],
  active: ['active', 'paused', 'retired'],
  paused: ['paused', 'active', 'retired'],
  retired: ['retired'],
} as const satisfies Readonly<Record<BenefitPlanState, readonly BenefitPlanState[]>>;

const controlStates = {
  pause: ['approved', 'running', 'scheduled'],
  resume: ['paused'],
  cancel: ['approved', 'paused', 'scheduled'],
} as const satisfies Readonly<Record<GrantControl, readonly GrantBatchState[]>>;

export class GrantPolicy {
  assertPlanTransition(current: BenefitPlanState | null, next: BenefitPlanState): void {
    if (current === null && next !== 'draft') throw new Error('BENEFIT_PLAN_MUST_START_DRAFT');
    if (current !== null && !(planTransitions[current] as readonly BenefitPlanState[]).includes(next)) throw new Error('BENEFIT_PLAN_TRANSITION_INVALID');
  }

  assertValidity(effective: Date, expires: Date, timezone: string): void {
    if (expires <= effective) throw new Error('BENEFIT_VALIDITY_INVALID');
    try { new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(effective); }
    catch { throw new Error('BENEFIT_TIMEZONE_INVALID'); }
  }

  assertControl(state: GrantBatchState, action: GrantControl): void {
    if (!(controlStates[action] as readonly GrantBatchState[]).includes(state)) throw new Error('BENEFIT_CONTROL_STATE_CONFLICT');
  }

  assertFourEyes(requester: string, actor: string): void {
    if (requester === actor) throw new Error('BENEFIT_FOUR_EYES_REQUIRED');
  }
}

export function planState(value: string): BenefitPlanState {
  if (!['draft', 'active', 'paused', 'retired'].includes(value)) throw new Error('BENEFIT_PLAN_STATE_INVALID');
  return value as BenefitPlanState;
}
