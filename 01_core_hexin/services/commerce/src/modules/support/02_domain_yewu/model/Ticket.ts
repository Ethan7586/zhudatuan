export type TicketState = 'open' | 'assigned' | 'waiting' | 'resolved' | 'closed';
export type TicketPriority = 'low' | 'normal' | 'high' | 'urgent';

const transitions: Readonly<Record<TicketState, readonly TicketState[]>> = Object.freeze({
  open: ['assigned', 'waiting', 'resolved'], assigned: ['open', 'waiting', 'resolved'], waiting: ['open', 'assigned', 'resolved'],
  resolved: ['open', 'closed'], closed: ['open'],
});

export class Ticket {
  constructor(readonly id: string, readonly conversation: string, readonly scope: string, readonly priority: TicketPriority,
    readonly state: TicketState, readonly version: number) {
    if (!id || !conversation || !scope || !Number.isSafeInteger(version) || version < 0) throw new Error('SUPPORT_TICKET_INVALID');
  }

  requireTransition(target: TicketState): void {
    if (!transitions[this.state].includes(target)) throw new Error(`SUPPORT_TICKET_TRANSITION_INVALID:${this.state}:${target}`);
  }
}
