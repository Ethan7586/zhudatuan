import { describe, expect, it, vi } from 'vitest';
import type { OperationRequest } from '../../../../foundation/application/OperationHandler';
import type { OperationDatabase, OperationLifecycle } from '../../../../foundation/application/ModuleOperations';
import type { KmsClient } from '../../../../foundation/infrastructure/KmsClient';
import type { SupportPortFactory } from '../../01_public_gongkai/SupportPort';
import { openConversationOperations } from '../../03_application_yingyong/command/OpenConversation';

describe('support case command', () => {
  it('creates an unassigned case without SLA deadlines when no policy is configured', async () => {
    const enqueue = vi.fn();
    const history = vi.fn();
    const message = vi.fn();
    const ports = (() => ({
      member: async () => 'member:one',
      assertOrder: vi.fn(),
      benefit: vi.fn(),
      agents: async () => [],
      rules: async () => [],
      sla: async () => null,
      enqueue,
      history,
      message,
    })) as unknown as SupportPortFactory;
    const query = vi.fn(async (sql: string, _parameters?: readonly unknown[]) => sql.startsWith('insert into support.ticket')
      ? { rows: [{ id: 'case:one', response_due_at: null, resolution_due_at: null, version: 0 }], rowCount: 1 }
      : { rows: [], rowCount: 1 });
    const lifecycle = caseLifecycle(kms(), ports);
    const input = request();
    const prepared = await lifecycle.prepare!(input);

    const result = await lifecycle.execute(input, { query } as unknown as OperationDatabase, prepared);

    expect(result.status).toBe(201);
    expect(result.body).toMatchObject({ id: 'case:one', subject: '需要帮助', channel: 'inapp',
      response_due_at: null, resolution_due_at: null });
    const ticketInsert = query.mock.calls.find(([sql]) => String(sql).startsWith('insert into support.ticket'));
    expect(ticketInsert?.[0]).toContain('case when $6::integer is null then null');
    expect(ticketInsert?.[1]?.[5]).toBeNull();
    expect(ticketInsert?.[1]?.[6]).toBeNull();
    expect(enqueue).not.toHaveBeenCalled();
    expect(history).toHaveBeenCalledTimes(1);
    expect(message).toHaveBeenCalledTimes(1);
  });
});

function caseLifecycle(client: KmsClient, ports: SupportPortFactory): OperationLifecycle {
  const action = openConversationOperations(client, ports)['support.cases.create'];
  if (!action || typeof action === 'function') throw new Error('SUPPORT_CASE_CREATE_LIFECYCLE_MISSING');
  return action;
}

function kms(): KmsClient {
  return { encrypt: async () => ({ ciphertext: 'ciphertext-message-value', fingerprint: 'a'.repeat(64), keyVersion: 'v1' }) } as unknown as KmsClient;
}

function request(): OperationRequest {
  return { type: 'support.cases.create', access: { membership: { id: 'membership:one' }, scope: { id: 'mall:one' },
    actor: { id: 'actor:one', target: 'console' }, trace: 'trace:support' }, input: { path: {},
    body: { subject: '需要帮助', message: '请协助处理。', channel: 'inapp', priority: 'normal' },
    idempotency: 'idem:support-case' } } as unknown as OperationRequest;
}
