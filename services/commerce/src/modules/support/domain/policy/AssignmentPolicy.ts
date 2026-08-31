import type { Policy } from '../../../../foundation/domain/Policy';
import type { AssignmentRule } from '../model/AssignmentRule';
import type { TicketPriority } from '../model/Ticket';

export interface Agent {
  readonly id: string;
  readonly online: boolean;
  readonly load: number;
  readonly skills: readonly string[];
  readonly scopes: readonly string[];
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
    if (input.rules && priority && !input.rules.some((rule) => rule.scope === input.scope && rule.matches(input.skill, priority))) return null;
    return input.agents.filter((agent) => agent.online && agent.scopes.includes(input.scope) && agent.skills.includes(input.skill)).sort((left, right) => left.load - right.load || left.id.localeCompare(right.id))[0] ?? null;
  }
}
