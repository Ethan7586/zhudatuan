import { describe, expect, it, vi } from 'vitest';
import type { OperationRequest } from '../../../../foundation/application/OperationHandler';
import type { OperationDatabase, OperationLifecycle } from '../../../../foundation/application/ModuleOperations';
import type { KmsClient } from '../../../../foundation/infrastructure/KmsClient';
import type { SupportPortFactory } from '../port/SupportPort';
import { sendMessageOperations } from './SendMessage';

describe('support message command', () => {
  it('requires an expected ticket version before encryption or database work', async () => {
    const encrypt = vi.fn();
    const lifecycle = messageLifecycle({ encrypt } as unknown as KmsClient, (() => ({})) as unknown as SupportPortFactory);
    await expect(lifecycle.prepare!(request())).rejects.toThrow('EXPECTED_VERSION_REQUIRED');
    expect(encrypt).not.toHaveBeenCalled();
  });

  it('binds the locked ticket lookup to the expected version and reports a conflict', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 });
    const ports = (() => ({ member: async () => 'member:one' })) as unknown as SupportPortFactory;
    const lifecycle = messageLifecycle(kms(), ports);
    const input = request(12);
    const prepared = await lifecycle.prepare!(input);
    await expect(lifecycle.execute(input, { query } as unknown as OperationDatabase, prepared)).rejects.toThrow('VERSION_CONFLICT');
    expect(query.mock.calls[0]?.[0]).toContain('ticket.version=$4');
    expect(query.mock.calls[0]?.[1]).toEqual(['case:one', 'platform:root', 'member:one', 12]);
  });
});

function messageLifecycle(client: KmsClient, ports: SupportPortFactory): OperationLifecycle {
  const action = sendMessageOperations(client, ports)['support.messages.send'];
  if (!action || typeof action === 'function') throw new Error('SUPPORT_SEND_LIFECYCLE_MISSING');
  return action;
}

function kms(): KmsClient {
  return { encrypt: async () => ({ ciphertext: 'ciphertext-message-value', fingerprint: 'a'.repeat(64), keyVersion: 'v1' }) } as unknown as KmsClient;
}

function request(expectedVersion?: number): OperationRequest {
  return { type: 'support.messages.send', access: { membership: { id: 'membership:one' }, scope: { id: 'platform:root' },
    actor: { id: 'agent:one', target: 'console' }, trace: 'trace:support' }, input: { path: { caseid: 'case:one' },
    body: { message: '回复内容' }, ...(expectedVersion === undefined ? {} : { expectedVersion }) } } as unknown as OperationRequest;
}
