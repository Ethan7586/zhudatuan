import { describe, expect, it } from 'vitest';
import { mapCases, mapConversation } from './infrastructure/SupportMapper';

describe('support mapping', () => {
  it('keeps member ticket and encrypted-message projections explicit', () => {
    const page = mapCases({
      items: [
        {
          id: 'case:1',
          conversation_id: 'conversation:1',
          subject: '配送问题',
          priority: 'normal',
          state: 'open',
          order_id: null,
          assigned_agent_id: null,
          response_due_at: '2026-08-31T01:00:00Z',
          resolution_due_at: '2026-09-01T01:00:00Z',
          updated_at: '2026-08-31T00:00:00Z',
          version: 0,
        },
      ],
    });
    const conversation = mapConversation({ items: [{ id: 'message:1', authorType: 'agent', author: 'agent:1', body: '已受理', createdAt: '2026-08-31T00:01:00Z' }], attachments: [] });
    expect(page.items[0]?.subject).toBe('配送问题');
    expect(conversation.items[0]?.body).toBe('已受理');
  });
});
