import { describe, expect, it } from 'vitest';
import { GrantPolicy } from '../../02_domain_yewu/policy/GrantPolicy';

const policy = new GrantPolicy();

describe('benefit grant invariants', () => {
  it('starts plans as draft and makes retired terminal', () => {
    expect(() => policy.assertPlanTransition(null, 'draft')).not.toThrow();
    expect(() => policy.assertPlanTransition(null, 'active')).toThrow('BENEFIT_PLAN_MUST_START_DRAFT');
    expect(() => policy.assertPlanTransition('active', 'paused')).not.toThrow();
    expect(() => policy.assertPlanTransition('retired', 'active')).toThrow('BENEFIT_PLAN_TRANSITION_INVALID');
  });

  it('validates grant instants and IANA timezone', () => {
    expect(() => policy.assertValidity(new Date('2026-01-01T00:00:00Z'), new Date('2026-02-01T00:00:00Z'), 'Asia/Shanghai')).not.toThrow();
    expect(() => policy.assertValidity(new Date('2026-02-01T00:00:00Z'), new Date('2026-01-01T00:00:00Z'), 'Asia/Shanghai')).toThrow('BENEFIT_VALIDITY_INVALID');
    expect(() => policy.assertValidity(new Date('2026-01-01T00:00:00Z'), new Date('2026-02-01T00:00:00Z'), 'Mars/Olympus')).toThrow('BENEFIT_TIMEZONE_INVALID');
  });

  it('enforces batch controls and four-eyes', () => {
    expect(() => policy.assertControl('running', 'pause')).not.toThrow();
    expect(() => policy.assertControl('paused', 'resume')).not.toThrow();
    expect(() => policy.assertControl('completed', 'cancel')).toThrow('BENEFIT_CONTROL_STATE_CONFLICT');
    expect(() => policy.assertFourEyes('actor-a', 'actor-a')).toThrow('BENEFIT_FOUR_EYES_REQUIRED');
  });
});
