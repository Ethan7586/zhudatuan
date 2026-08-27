import type { TicketPriority } from './Ticket';

export class AssignmentRule {
  constructor(readonly id: string, readonly scope: string, readonly skill: string, readonly priorities: readonly TicketPriority[],
    readonly weight: number, readonly enabled: boolean) {
    if (!id || !scope || !skill || priorities.length === 0 || priorities.some((priority) => !['low','normal','high','urgent'].includes(priority))
      || !Number.isSafeInteger(weight) || weight < 1 || weight > 1000) {
      throw new Error('SUPPORT_ASSIGNMENT_RULE_INVALID');
    }
  }

  matches(skill: string, priority: TicketPriority): boolean { return this.enabled && this.skill === skill && this.priorities.includes(priority); }
}
