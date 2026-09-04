import { describe, expect, it } from 'vitest';
import { Ticket } from './Ticket';

describe('Ticket', () => {
  it('enforces the lifecycle and exact assigned participant', () => {
    const ticket = new Ticket('ticket:one', 'conversation:one', 'mall:one', 'urgent', 'assigned', 'agent:one', null, 2);
    expect(() => ticket.assertAgent('agent:two')).toThrow('SUPPORT_TICKET_PARTICIPANT_DENIED');
    expect(() => ticket.requireTransition('closed')).toThrow('SUPPORT_TICKET_TRANSITION_INVALID');
    expect(() => ticket.requireTransition('waiting')).not.toThrow();
  });

  it('allows reopening only inside the persisted SLA window', () => {
    const ticket = new Ticket('ticket:one', 'conversation:one', 'mall:one', 'normal', 'closed', 'agent:one', '2026-09-06T01:00:00.000Z', 4);
    expect(() => ticket.requireTransition('open', new Date('2026-09-06T00:59:59.000Z'))).not.toThrow();
    expect(() => ticket.requireTransition('open', new Date('2026-09-06T01:00:00.001Z'))).toThrow('SUPPORT_TICKET_REOPEN_WINDOW_EXPIRED');
  });

  it('rejects assignment and reopen-window state contradictions', () => {
    expect(() => new Ticket('ticket:one', 'conversation:one', 'mall:one', 'normal', 'waiting', null, null, 1)).toThrow('SUPPORT_TICKET_ASSIGNMENT_INVALID');
    expect(() => new Ticket('ticket:one', 'conversation:one', 'mall:one', 'normal', 'closed', null, null, 1)).toThrow('SUPPORT_TICKET_REOPEN_WINDOW_INVALID');
  });
});
