import type { Policy } from '../../../../foundation/domain/Policy';
import type { AssignmentRule } from '../model/AssignmentRule';
import type { TicketPriority } from '../model/Ticket';

export interface Agent {
  readonly id: string;
  readonly online: boolean;
  readonly state: 'offline' | 'available' | 'busy' | 'disabled';
  readonly load: number;
  readonly capacity: number;
  readonly skills: readonly string[];
  readonly scopes: readonly string[];
  readonly lastAssignedAt: string | null;
}
export interface Assignment {
  readonly agents: readonly Agent[];
  readonly rules?: readonly AssignmentRule[];
  readonly scope: string;
  readonly skill: string;
  readonly priority?: TicketPriority;
}

export class AssignmentPolicy implements Policy<Assignment, Agent | null> {
  decide(input: Assignment): Agent | null {
    const priority = input.priority;
    const rules = input.rules?.filter((rule) => priority && rule.scope === input.scope && rule.matches(input.skill, priority)) ?? [];
    if (input.rules && priority && rules.length === 0) return null;
    const weight = Math.max(0, ...rules.map((rule) => rule.weight));
    return (
      input.agents
        .filter((agent) => agent.state === 'available' && agent.online && agent.scopes.includes(input.scope) && agent.skills.includes(input.skill) && agent.load < agent.capacity)
        .map((agent) => ({ agent, loadRatio: agent.load / agent.capacity, weight }))
        .sort((left, right) => left.loadRatio - right.loadRatio || right.weight - left.weight || instant(left.agent.lastAssignedAt) - instant(right.agent.lastAssignedAt) || left.agent.id.localeCompare(right.agent.id))[0]?.agent ?? null
    );
  }
}

function instant(value: string | null): number {
  return value === null ? 0 : Date.parse(value);
}
