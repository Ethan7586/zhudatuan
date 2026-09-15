import { describe, expect, it, vi } from 'vitest';
import type { OperationRequest } from '../../../../foundation/application/OperationHandler';
import type { OperationDatabase, OperationLifecycle } from '../../../../foundation/application/ModuleOperations';
import type { KmsClient } from '../../../../foundation/infrastructure/KmsClient';
import type { ObjectStore } from '../../../../foundation/infrastructure/ObjectStore';
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

  it('stores attachment bytes before registering scoped evidence and a scan job', async () => {
    const append = vi.fn(); const complete = vi.fn().mockResolvedValue({ reference: 'object:proof', sha256: 'a'.repeat(64), size: 3, scan: 'clean' });
    const abort = vi.fn(); const create = vi.fn().mockResolvedValue({ append, complete, abort });
    const enqueue = vi.fn(); const history = vi.fn();
    const ports = (() => ({ member: async () => 'member:one', enqueue, history })) as unknown as SupportPortFactory;
    const action = sendMessageOperations(kms(), ports, { create } as unknown as ObjectStore)['support.attachments.create'];
    if (typeof action !== 'function') throw new Error('SUPPORT_ATTACHMENT_ACTION_MISSING');
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [{ conversation_id: 'conversation:one', scope_id: 'platform:root' }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ id: 'evidence:one', state: 'pending' }], rowCount: 1 });
    const attachment = { ...request(), type: 'support.attachments.create', input: { path: { caseid: 'case:one' }, query: {},
      body: { name: 'proof.png', contentType: 'image/png', contentBase64: 'iVBORw0KGgo=', visibility: 'internal' } } } as unknown as OperationRequest;

    const result = await action(attachment, { query } as unknown as OperationDatabase);

    expect(create).toHaveBeenCalledWith(expect.stringMatching(/^support\/evidence\/.+\.png$/), 'image/png');
    expect(append).toHaveBeenCalledWith(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    expect(enqueue).toHaveBeenCalledWith('supportscan', 'platform:root', expect.objectContaining({ evidence: expect.stringMatching(/^evidence:/) }),
      undefined, expect.stringMatching(/^job:scan:evidence:/));
    expect(history).toHaveBeenCalledWith('case:one', 'platform:root', 'attachment.uploaded', 'agent:one',
      expect.objectContaining({ name: 'proof.png', visibility: 'internal' }));
    expect(result.status).toBe(202);
  });

  it('rejects a file whose bytes do not match the declared image type', async () => {
    const create = vi.fn();
    const ports = (() => ({ member: async () => 'member:one' })) as unknown as SupportPortFactory;
    const action = sendMessageOperations(kms(), ports, { create } as unknown as ObjectStore)['support.attachments.create'];
    if (typeof action !== 'function') throw new Error('SUPPORT_ATTACHMENT_ACTION_MISSING');
    const query = vi.fn().mockResolvedValueOnce({ rows: [{ conversation_id: 'conversation:one', scope_id: 'platform:root' }], rowCount: 1 });
    const attachment = { ...request(), type: 'support.attachments.create', input: { path: { caseid: 'case:one' }, query: {},
      body: { name: 'fake.png', contentType: 'image/png', contentBase64: 'AQID', visibility: 'public' } } } as unknown as OperationRequest;

    await expect(action(attachment, { query } as unknown as OperationDatabase)).rejects.toThrow('SUPPORT_ATTACHMENT_CONTENT_INVALID');
    expect(create).not.toHaveBeenCalled();
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
