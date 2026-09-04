import { describe, expect, it, vi } from 'vitest';
import { result, withReadTransaction } from '../../../../test/TransactionFixture';
import { PgConversationRepository } from './PgConversationRepository';

const execution = { operation: 'support.messages.read', headers: {}, traceId: 'trace:one' } as never;
const actor = { actor: 'actor:one', membership: 'membership:one', member: 'member:one', target: 'storefront', scope: 'mall:one', scopes: ['mall:one'], trace: 'trace:one' } as const;

describe('PgConversationRepository', () => {
  it('filters internal fields in SQL and authorizes downloads only after a clean scan', async () => {
    const authorize = vi.fn(async (reference: string) => ({ url: `https://objects.test/${reference}`, expiresAt: '2026-09-06T01:00:00.000Z' }));
    const queries: string[] = [];
    const query = vi.fn(async (sql: string) => {
      queries.push(sql);
      if (sql.includes('select conversation.id')) return result([{ id: 'conversation:one', scope_id: 'mall:one', member_id: 'member:one', version: 4, latest_sequence: 2, last_read_sequence: 1 }]);
      if (sql.includes('from support.message message')) return result([{ id: 'message:one', client_message_id: 'client:0001', conversation_id: 'conversation:one', scope_id: 'mall:one', author_type: 'agent', author_id: 'actor:agent', kind: 'attachment', visibility: 'external', body_ciphertext: 'ciphertext', sequence: 2, version: 1, created_at: '2026-09-06T00:00:00.000Z' }]);
      return result([
        evidence('clean', 'object:clean', null, null),
        evidence('pending', 'object:pending', null, null),
        evidence('rejected', 'object:rejected', 'VIRUS_DETECTED', '请删除后重新上传。'),
      ]);
    });
    const repository = new PgConversationRepository(
      { decrypt: vi.fn(async () => '附件说明') } as never,
      { authorize } as never,
      { actor: vi.fn(async () => actor), view: vi.fn(async () => ({ member: { id: 'member:one', displayName: '测试用户', employeeNo: null, mobileMasked: null }, organization: { id: 'mall:one' }, orders: [], benefits: [] })) } as never
    );
    const checkpoint = await withReadTransaction(query, (context) => repository.readMessages(context, { path: { caseid: 'ticket:one' }, query: {} } as never, execution));
    const response = await repository.finalizeMessages({ path: { caseid: 'ticket:one' }, query: {} } as never, execution, checkpoint);
    expect(queries.find((sql) => sql.includes('from support.message message'))).toContain("message.visibility='external'");
    expect(authorize).toHaveBeenCalledTimes(1);
    expect(authorize).toHaveBeenCalledWith('object:clean', 300);
    expect(response.body.attachments).toEqual(expect.arrayContaining([expect.objectContaining({ state: 'rejected', rejectionReason: 'VIRUS_DETECTED', recoveryAction: '请删除后重新上传。' })]));
  });
});

function evidence(state: 'pending' | 'clean' | 'rejected', object_ref: string, scan_reason: string | null, scan_recovery: string | null) {
  return { id: `evidence:${state}`, message_id: 'message:one', original_name: `${state}.png`, content_type: 'image/png', size_bytes: 9, state, scan_reason, scan_recovery, object_ref, created_at: '2026-09-06T00:00:00.000Z' };
}
