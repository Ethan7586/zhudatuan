import type { QueryResult } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import { withReadTransaction } from '../../../../test/TransactionFixture';
import { PgTicketRepository } from './PgTicketRepository';

describe('PgTicketRepository order lookup', () => {
  it('uses an exact indexed order filter instead of overloading keyword search', async () => {
    const query = vi.fn(async (_sql: string, _values?: readonly unknown[]) => result([]));
    const repository = new PgTicketRepository(
      {} as never,
      { actor: vi.fn(async () => ({ actor: 'actor:one', membership: 'membership:one', member: 'member:one', target: 'console', scope: 'enterprise:one', scopes: ['enterprise:one'], trace: 'trace:one' })) } as never,
      { findByMembership: vi.fn(async () => null) } as never,
      {} as never,
      {} as never,
      {} as never
    );

    await withReadTransaction(query, (context) => repository.readCases(context, { query: { limit: 50, orderId: 'order:one' } }, {} as never));

    const read = query.mock.calls.find(([sql]) => sql.includes('from support.ticket'));
    expect(read?.[0]).toContain('conversation.order_id=$17');
    expect(read?.[1]?.[16]).toBe('order:one');
    expect(read?.[1]?.[11]).toBeNull();
  });

  it('adds the readable assigned-agent name through the scoped member projection', async () => {
    const agentLabels = vi.fn(async () => [{ membership: 'membership:support', displayName: '王客服' }]);
    const query = vi.fn(async (sql: string) => (sql.includes('from support.ticket') ? result([ticketRow()]) : result([])));
    const repository = namedRepository(agentLabels);

    const response = await withReadTransaction(query, (context) => repository.readCases(context, { query: { limit: 50 } }, {} as never));

    expect(response.body.items[0]).toMatchObject({ assigned_agent_id: 'agent:one', assigned_agent_name: '王客服' });
    expect(response.body.items[0]).not.toHaveProperty('assigned_agent_membership_id');
    expect(agentLabels).toHaveBeenCalledWith(expect.anything(), ['membership:support'], 'enterprise:one');
  });
});

function namedRepository(agentLabels: ReturnType<typeof vi.fn>) {
  return new PgTicketRepository(
    {} as never,
    {
      actor: vi.fn(async () => ({ actor: 'actor:one', membership: 'membership:one', member: 'member:one', target: 'console', scope: 'enterprise:one', scopes: ['enterprise:one'], trace: 'trace:one' })),
      agentLabels,
    } as never,
    { findByMembership: vi.fn(async () => null) } as never,
    {} as never,
    {} as never,
    {} as never
  );
}

function ticketRow() {
  return {
    id: 'case:one',
    scope_id: 'enterprise:one',
    priority: 'normal',
    state: 'assigned',
    assigned_agent_id: 'agent:one',
    assigned_agent_membership_id: 'membership:support',
    response_due_at: '2026-09-09T01:00:00.000Z',
    resolution_due_at: '2026-09-09T08:00:00.000Z',
    created_at: '2026-09-09T00:00:00.000Z',
    updated_at: '2026-09-09T00:30:00.000Z',
    version: 2,
    conversation_id: 'conversation:one',
    skill: 'general',
    member_id: 'member:one',
    order_id: null,
    channel: 'inapp',
    subject: '配送时间咨询',
    reference_type: null,
    reference_id: null,
    unread_count: 1,
    sla_risk: 'normal',
  };
}

function result(rows: readonly unknown[]): QueryResult<any> {
  return { rows: [...rows], rowCount: rows.length, command: '', oid: 0, fields: [] } as QueryResult<any>;
}
