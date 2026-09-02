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
    const rule = new AssignmentRule('rule:one', 'mall:one', 'vip', ['urgent'], 100, true);
    expect(policy.decide({ scope: 'mall:one', skill: 'general', priority: 'normal', agents: [agent('agent:a')], rules: [rule] })).toBeNull();
    expect(policy.decide({ scope: 'mall:one', skill: 'vip', priority: 'urgent', agents: [agent('agent:a', { skills: ['vip'] })], rules: [rule] })?.id).toBe('agent:a');
  });
});
