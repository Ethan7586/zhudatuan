import { describe, expect, it } from 'vitest';
import { AssignmentRule } from '../model/AssignmentRule';
import { AssignmentPolicy, type Agent } from './AssignmentPolicy';

const agent = (id: string, override: Partial<Agent> = {}): Agent => ({ id, online: true, state: 'available', load: 0, capacity: 10, skills: ['general'], scopes: ['mall:one'], lastAssignedAt: null, ...override });

describe('AssignmentPolicy', () => {
  it('filters scope, online state, skills and capacity before deterministic load ordering', () => {
    const selected = new AssignmentPolicy().decide({ scope: 'mall:one', skill: 'general', agents: [agent('agent:scope', { scopes: ['mall:two'] }), agent('agent:offline', { online: false }), agent('agent:full', { load: 10 }), agent('agent:b', { load: 1 }), agent('agent:a', { load: 1 })] });
    expect(selected?.id).toBe('agent:a');
  });

  it('requires an active matching rule when rules are configured', () => {
    const policy = new AssignmentPolicy();
    const rule = new AssignmentRule('rule:one', 'mall:one', 'vip', ['urgent'], 100, true, 1);
    expect(policy.decide({ scope: 'mall:one', skill: 'general', priority: 'normal', agents: [agent('agent:a')], rules: [rule] })).toBeNull();
    expect(policy.decide({ scope: 'mall:one', skill: 'vip', priority: 'urgent', agents: [agent('agent:a', { skills: ['vip'] })], rules: [rule] })?.id).toBe('agent:a');
  });

  it('uses exactly the same eligibility rules for a requested manual assignee', () => {
    const policy = new AssignmentPolicy();
    const input = { scope: 'mall:one', skill: 'general', priority: 'normal' as const, agents: [agent('agent:full', { load: 10 }), agent('agent:ready')] };
    expect(policy.select(input, 'agent:full')).toBeNull();
    expect(policy.select(input, 'agent:ready')?.id).toBe('agent:ready');
    expect(policy.decide(input)?.id).toBe('agent:ready');
  });
});
