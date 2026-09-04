import { describe, expect, it } from 'vitest';
import { mapCases, mapConversation } from './infrastructure/SupportMapper';

describe('support mapping', () => {
  it('keeps member ticket and encrypted-message projections explicit', () => {
    const page = mapCases({
      items: [
        {
          id: 'case:1',
          scope_id: 'mall:1',
          conversation_id: 'conversation:1',
          member_id: 'member:1',
          subject: '配送问题',
          channel: 'inapp',
          priority: 'normal',
          state: 'open',
          order_id: null,
          reference_type: null,
          reference_id: null,
          assigned_agent_id: null,
          response_due_at: '2026-08-31T01:00:00Z',
          resolution_due_at: '2026-09-01T01:00:00Z',
          created_at: '2026-08-31T00:00:00Z',
          updated_at: '2026-08-31T00:00:00Z',
          version: 1,
          skill: 'general',
          unread_count: 1,
          sla_risk: 'normal',
        },
      ],
      count: 1,
    });
    const conversation = mapConversation({
      items: [{ id: 'message:1', clientMessageId: 'client:1', conversationId: 'conversation:1', authorType: 'agent', authorId: 'agent:1', body: '已受理', sequence: 1, version: 1, createdAt: '2026-08-31T00:01:00Z' }],
      attachments: [],
      context: { member: { id: 'member:1', displayName: '测试员工', employeeNo: 'E1001', mobileMasked: '138****0000' }, organization: { id: 'mall:1' }, orders: [], benefits: [] },
      count: 1,
      conversationVersion: 1,
      latestSequence: 1,
      lastReadSequence: 0,
    });
    expect(page.items[0]?.subject).toBe('配送问题');
    expect(conversation.items[0]?.body).toBe('已受理');
  });
});
