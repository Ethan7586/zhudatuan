import { describe, expect, it, vi } from 'vitest';
import type { ChannelWebhookRepository } from '../application/port/ChannelWebhookRepository';
import { ApplyChannelWebhook } from '../application/process/ApplyChannelWebhook';
import { ChannelWebhookJob } from '../interface/job/ChannelWebhookJob';

const hash = 'a'.repeat(64);
const receivedAt = '2026-09-06T00:00:00.000Z';

describe('channel webhook application', () => {
  it('verifies encrypted receipt evidence before creating the normalized Inbox and publishing its standard event', async () => {
    const fixture = harness();
    await fixture.application.execute(fixture.receipt.id, fixture.execution);
    expect(fixture.verify).toHaveBeenCalledOnce();
    expect(fixture.verify).toHaveBeenCalledWith(expect.objectContaining({ signal: fixture.execution.signal, deadline: fixture.execution.deadline }), expect.anything());
    expect(fixture.verify.mock.invocationCallOrder[0]).toBeLessThan(fixture.apply.mock.invocationCallOrder[0]!);
    expect(fixture.apply).toHaveBeenCalledWith({}, fixture.receipt, {
      eventType: 'shipment.changed', reference: 'external:one', kind: 'tracking', state: 'succeeded',
      normalized: { eventType: 'shipment.changed', reference: 'external:one', kind: 'tracking', state: 'succeeded' },
    });
    expect(fixture.publish).toHaveBeenCalledOnce();
    expect(JSON.stringify(fixture.apply.mock.calls[0]![2])).not.toContain('private-provider-field');
  });

  it('deduplicates a replay without publishing a second module event', async () => {
    const fixture = harness({ status: 'duplicate' });
    await fixture.application.execute(fixture.receipt.id, fixture.execution);
    expect(fixture.apply).toHaveBeenCalledOnce();
    expect(fixture.publish).not.toHaveBeenCalled();
    expect(fixture.record).not.toHaveBeenCalled();
  });

  it('routes an unknown external mapping to a safe provider deadletter without emitting an event', async () => {
    const fixture = harness({ status: 'deadlettered', error: 'CHANNEL_WEBHOOK_MAPPING_MISSING' });
    await fixture.application.execute(fixture.receipt.id, fixture.execution);
    expect(fixture.publish).not.toHaveBeenCalled();
    expect(fixture.record).toHaveBeenCalledWith({}, expect.objectContaining({
      kind: 'provider', source: fixture.receipt.id, owner: 'channel', error: 'CHANNEL_WEBHOOK_MAPPING_MISSING', attempts: 1,
      payload: expect.objectContaining({ rawHash: hash, externalHash: expect.stringMatching(/^[a-f0-9]{64}$/) }),
    }));
    expect(JSON.stringify(fixture.record.mock.calls[0]![1])).not.toMatch(/external:one|private-provider-field/);
  });

  it('does not create an Inbox when signature verification fails or the provider is unavailable', async () => {
    const invalid = harness();
    invalid.verify.mockResolvedValue(false);
    await expect(invalid.application.execute(invalid.receipt.id, invalid.execution)).rejects.toThrow('PROVIDER_WEBHOOK_SIGNATURE_INVALID');
    expect(invalid.apply).not.toHaveBeenCalled();
    const unavailable = harness();
    unavailable.strategy.mockImplementation(() => { throw new Error('PROVIDER_INSTALLATION_NOT_ACTIVE'); });
    await expect(unavailable.application.execute(unavailable.receipt.id, unavailable.execution)).rejects.toThrow('PROVIDER_INSTALLATION_NOT_ACTIVE');
    expect(unavailable.apply).not.toHaveBeenCalled();
  });

  it('requires exact task scope and records terminal domain failure classification', async () => {
    const fixture = harness();
    const job = new ChannelWebhookJob(fixture.application);
    expect(() => job.process({ id: 'job:one', kind: 'channelwebhook', scope: null, payload: { receipt: fixture.receipt.id },
      authorization: {}, attempts: 1, token: 1 }, fixture.execution.signal)).toThrow('CHANNEL_WEBHOOK_SCOPE_REQUIRED');
    await job.record({} as never, { id: 'job:one', kind: 'channelwebhook', scope: 'mall:one', payload: { receipt: fixture.receipt.id },
      authorization: {}, attempts: 8, token: 1 }, 'PROVIDER_WEBHOOK_SIGNATURE_INVALID');
    expect(fixture.fail).toHaveBeenCalledWith({}, fixture.receipt.id, 'mall:one', {
      classification: 'authentication', code: 'PROVIDER_WEBHOOK_SIGNATURE_INVALID', retryable: false,
    });
  });

  it('stops before claiming work when the task has already been cancelled', async () => {
    const fixture = harness();
    const controller = new AbortController();
    controller.abort(new Error('CHANNEL_WEBHOOK_CANCELLED'));
    await expect(fixture.application.execute(fixture.receipt.id, { ...fixture.execution, signal: controller.signal })).rejects.toThrow('CHANNEL_WEBHOOK_CANCELLED');
    expect(fixture.verify).not.toHaveBeenCalled();
    expect(fixture.apply).not.toHaveBeenCalled();
  });
});

function harness(outcome: Parameters<typeof outcomeValue>[0] = { status: 'applied' }) {
  const receipt = Object.freeze({ id: `webhookreceipt:${hash}`, connection: 'connection:one', provider: 'supplier', scope: 'mall:one',
    external: 'event:one', attempts: 1, ciphertext: 'kms:ciphertext', keyVersion: 'kms:v1', rawHash: hash,
    signatureHash: hash, trace: 'trace:one', receivedAt, version: 1 });
  const apply = vi.fn().mockResolvedValue(outcomeValue(outcome));
  const fail = vi.fn().mockResolvedValue(undefined);
  const repository: ChannelWebhookRepository = { claim: vi.fn().mockResolvedValue(receipt), apply, fail };
  const publish = vi.fn().mockResolvedValue(undefined);
  const record = vi.fn().mockResolvedValue(undefined);
  const verify = vi.fn().mockResolvedValue(true);
  const strategy = vi.fn().mockReturnValue({ verify, normalize: vi.fn().mockReturnValue({ eventType: 'shipment.changed',
    externalReference: 'external:one', kind: 'tracking', state: 'delivered', private: 'private-provider-field' }) });
  const transactions = { write: async (_options: unknown, work: (context: never) => Promise<unknown>) => work({} as never) };
  const kms = { decrypt: vi.fn().mockResolvedValue(JSON.stringify({ headers: { 'x-provider-signature': 'signature' }, body: '{}', receivedAt })) };
  const application = new ApplyChannelWebhook(transactions as never, repository, { publish } as never, { record } as never,
    { strategy } as never, kms as never);
  const execution = { scope: 'mall:one', trace: 'job:one', signal: new AbortController().signal, deadline: Date.now() + 30_000 };
  return { application, receipt, execution, apply, fail, publish, record, verify, strategy };
}

function outcomeValue(value: { readonly status: 'applied' | 'duplicate' } | { readonly status: 'deadlettered'; readonly error: 'CHANNEL_WEBHOOK_MAPPING_MISSING' }) {
  return value.status === 'applied' ? { status: 'applied' as const, event: { webhook: `webhook:${hash}`, provider: 'supplier',
    kind: 'tracking', reference: 'external:one', operation: 'operation:one', internalReference: 'fulfillment:one', state: 'succeeded' as const } } : value;
}
