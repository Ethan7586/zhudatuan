import { describe, expect, it, vi } from 'vitest';
import { result, withReadTransaction } from '../../../../test/TransactionFixture';
import { PgAgentRepository } from './PgAgentRepository';

const actor = { actor: 'actor:one', membership: 'membership:owner', member: 'member:owner', target: 'console', scope: 'mall:one', scopes: ['mall:one'], trace: 'trace:one' } as const;

describe('PgAgentRepository', () => {
  it('returns scope-redacted display names instead of exposing membership identifiers as labels', async () => {
    const agentLabels = vi.fn(async () => [{ membership: 'membership:one', displayName: '王客服' }]);
    const repository = new PgAgentRepository({ actor: vi.fn(async () => actor), agentLabels } as never);
    const query = vi.fn(async (sql: string) =>
      sql.includes('from support.agent')
        ? result([{ id: 'agent:one', scope_id: 'mall:one', membership_id: 'membership:one', skills: ['general'], capacity: 10, state: 'available', version: 2, last_assigned_at: null }])
        : result([])
    );

    const response = await withReadTransaction(query, (context) => repository.readAgents(context, { query: { limit: 50 } }, {} as never));

    expect(response.body.items).toEqual([{ id: 'agent:one', membership_id: 'membership:one', display_name: '王客服', skills: ['general'], capacity: 10, state: 'available', version: 2 }]);
    expect(agentLabels).toHaveBeenCalledWith(expect.anything(), ['membership:one'], 'mall:one');
  });
});
