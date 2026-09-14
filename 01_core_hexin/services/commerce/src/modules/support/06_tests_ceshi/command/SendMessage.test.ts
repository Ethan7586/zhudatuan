import { describe, expect, it, vi } from 'vitest';
import type { OperationRequest } from '../../../../foundation/application/OperationHandler';
import type { OperationDatabase, OperationLifecycle } from '../../../../foundation/application/ModuleOperations';
import type { KmsClient } from '../../../../foundation/infrastructure/KmsClient';
import type { SupportPortFactory } from '../../01_public_gongkai/SupportPort';
import { sendMessageOperations } from '../../03_application_yingyong/command/SendMessage';

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
    expect(query.mock.calls[0]?.[1]).toEqual(['case:one', 'platform:root', 'member:one', 12, 'console']);
  });

  it('accepts internal notes from console staff and rejects them from the requester surface', async () => {
    const encrypt = vi.fn().mockResolvedValue({ ciphertext: 'ciphertext', fingerprint: 'a'.repeat(64), keyVersion: 'v1' });
    const lifecycle = messageLifecycle({ encrypt } as unknown as KmsClient, (() => ({})) as unknown as SupportPortFactory);

    await expect(lifecycle.prepare!(request(12, 'internal'))).resolves.toMatchObject({ visibility: 'internal' });
    await expect(lifecycle.prepare!(request(12, 'internal', 'storefront'))).rejects.toThrow('SUPPORT_INTERNAL_NOTE_FORBIDDEN');
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

function request(expectedVersion?: number, visibility: 'public' | 'internal' = 'public', target: 'console' | 'storefront' = 'console'): OperationRequest {
  return { type: 'support.messages.send', access: { membership: { id: 'membership:one' }, scope: { id: 'platform:root' },
    actor: { id: 'agent:one', target }, trace: 'trace:support' }, input: { path: { caseid: 'case:one' },
    body: { message: '回复内容', visibility }, ...(expectedVersion === undefined ? {} : { expectedVersion }) } } as unknown as OperationRequest;
}
