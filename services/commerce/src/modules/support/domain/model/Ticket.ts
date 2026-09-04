export type TicketState = 'open' | 'assigned' | 'waiting' | 'resolved' | 'closed';
export type TicketPriority = 'low' | 'normal' | 'high' | 'urgent';

const transitions: Readonly<Record<TicketState, readonly TicketState[]>> = Object.freeze({
  open: ['assigned', 'waiting', 'resolved'],
  assigned: ['open', 'waiting', 'resolved'],
  waiting: ['open', 'assigned', 'resolved'],
  resolved: ['open', 'closed'],
  closed: ['open'],
});

export class Ticket {
  constructor(
    readonly id: string,
    readonly conversation: string,
    readonly scope: string,
    readonly priority: TicketPriority,
    readonly state: TicketState,
    readonly assignedAgent: string | null,
    readonly reopenUntil: string | null,
    readonly version: number
  ) {
    if (!id || !conversation || !scope || !Number.isSafeInteger(version) || version < 1) throw new Error('SUPPORT_TICKET_INVALID');
    if ((state === 'assigned' || state === 'waiting') && assignedAgent === null) throw new Error('SUPPORT_TICKET_ASSIGNMENT_INVALID');
    if ((state === 'closed') !== (reopenUntil !== null) || (reopenUntil !== null && Number.isNaN(Date.parse(reopenUntil)))) throw new Error('SUPPORT_TICKET_REOPEN_WINDOW_INVALID');
    Object.freeze(this);
  }

  requireTransition(target: TicketState, at?: Date): void {
    if (!transitions[this.state].includes(target)) throw new Error(`SUPPORT_TICKET_TRANSITION_INVALID:${this.state}:${target}`);
    if (this.state === 'closed' && target === 'open') {
      if (!at || this.reopenUntil === null || at.getTime() > Date.parse(this.reopenUntil)) {
        throw new Error('SUPPORT_TICKET_REOPEN_WINDOW_EXPIRED');
      }
    }
  }

  assertAgent(agent: string): void {
    if (!agent || this.assignedAgent !== agent) throw new Error('SUPPORT_TICKET_PARTICIPANT_DENIED');
  }
}
