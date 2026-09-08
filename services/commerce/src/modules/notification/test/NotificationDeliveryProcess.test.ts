import { describe, expect, it, vi } from 'vitest';
import type { KmsClient } from '../../../pipeline/KmsPort';
import { DeliveryRegistry } from '../infrastructure/registry/DeliveryRegistry';
import type { DeliveryRepository, QueuedDispatch } from '../application/port/DeliveryRepository';
import type { DeliveryChannel } from '../application/port/DeliveryChannel';
import { NotificationDeliveryProcess } from '../application/process/NotificationDeliveryProcess';
import { result, transactionManager } from '../../../test/TransactionFixture';

const challenge = 'challenge:00000000-0000-4000-8000-000000000001';

describe('identity challenge notification delivery safety', () => {
  it('does not decrypt or send a terminal sent/ambiguous attempt', async () => {
    const repository = repositoryWith({ sequence: 1, state: 'sent', dispatch: false });
    const decrypt = vi.fn(async () => 'unused');
    const send = vi.fn(async () => ({ provider: 'aliyun', externalId: 'sms:1' }));
    const command = commandWith(repository.value, { decrypt } as unknown as KmsClient, send);

    await command.challenge(challenge, execution());

    expect(decrypt).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
    expect(repository.complete).not.toHaveBeenCalled();
    expect(repository.ambiguous).not.toHaveBeenCalled();
  });

  it('persists sent only after provider receipt is returned', async () => {
    const repository = repositoryWith({ sequence: 2, state: 'sending', dispatch: true });
    const decrypt = vi.fn(async (_purpose: string, key: string) => (key === 'identity/challenge' ? '123456' : '+8613800138000'));
    const send = vi.fn(async () => ({ provider: 'aliyun', externalId: 'sms:2' }));
    const command = commandWith(repository.value, { decrypt } as unknown as KmsClient, send);

    await command.challenge(challenge, execution());

    expect(send).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        recipient: '+8613800138000',
        variables: { code: '123456' },
        idempotency: challenge,
      })
    );
    expect(repository.complete).toHaveBeenCalledExactlyOnceWith(expect.anything(), challenge, 2, 'aliyun', 'sms:2');
    expect(repository.ambiguous).not.toHaveBeenCalled();
  });

  it('marks provider or commit uncertainty ambiguous and never blindly resends it', async () => {
    const repository = repositoryWith({ sequence: 3, state: 'sending', dispatch: true });
    const decrypt = vi.fn(async (_purpose: string, key: string) => (key === 'identity/challenge' ? '123456' : '+8613800138000'));
    const send = vi.fn(async () => {
      throw new Error('PROVIDER_OUTCOME_UNKNOWN');
    });
    const command = commandWith(repository.value, { decrypt } as unknown as KmsClient, send);

    await expect(command.challenge(challenge, execution())).resolves.toBeUndefined();
    expect(repository.ambiguous).toHaveBeenCalledExactlyOnceWith(expect.anything(), challenge, 3, 'PROVIDER_OUTCOME_UNKNOWN');
    expect(repository.fail).not.toHaveBeenCalled();
  });

  it('records a definitive Aliyun rejection with its sanitized provider code', async () => {
    const repository = repositoryWith({ sequence: 4, state: 'sending', dispatch: true });
    const decrypt = vi.fn(async (_purpose: string, key: string) => (key === 'identity/challenge' ? '123456' : '+8613800138000'));
    const send = vi.fn(async () => {
      throw new Error('ALIYUN_SMS_ISV.SMS_SIGNATURE_ILLEGAL');
    });
    const command = commandWith(repository.value, { decrypt } as unknown as KmsClient, send);

    await expect(command.challenge(challenge, execution())).resolves.toBeUndefined();
    expect(repository.fail).toHaveBeenCalledExactlyOnceWith(expect.anything(), challenge, 4, 'ALIYUN_SMS_ISV.SMS_SIGNATURE_ILLEGAL');
    expect(repository.ambiguous).not.toHaveBeenCalled();
  });

  it('records a pre-send decrypt failure as failed and allows the job to retry', async () => {
    const repository = repositoryWith({ sequence: 5, state: 'sending', dispatch: true });
    const decrypt = vi.fn(async () => {
      throw new Error('KMS_DECRYPT_FAILED');
    });
    const send = vi.fn(async () => ({ provider: 'aliyun', externalId: 'sms:4' }));
    const command = commandWith(repository.value, { decrypt } as unknown as KmsClient, send);

    await expect(command.challenge(challenge, execution())).rejects.toThrow('KMS_DECRYPT_FAILED');
    expect(repository.fail).toHaveBeenCalledExactlyOnceWith(expect.anything(), challenge, 5, 'KMS_DECRYPT_FAILED');
    expect(send).not.toHaveBeenCalled();
  });
});

describe('notification outbox delivery', () => {
  it('uses the frozen dispatch snapshot and records permanent failures without retrying the runtime job', async () => {
    const fail = vi.fn(async () => true);
    const send = vi.fn(async () => {
      throw new Error('EMAIL_DELIVERY_REQUEST_INVALID');
    });
    const command = deliveryCommand({ claim: vi.fn(async () => dispatchRecord()), fail } as unknown as DeliveryRepository, send);

    await expect(command.dispatch('dispatch:one', execution())).resolves.toBeUndefined();
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ providerTemplate: 'paid-v4', variables: { order: 'O1' }, idempotency: 'dispatch:one' }));
    expect(fail).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ template_version: 4 }),
      'email.1',
      1,
      expect.objectContaining({ kind: 'permanent', code: 'EMAIL_DELIVERY_REQUEST_INVALID', message: expect.stringMatching(/[\u3400-\u9fff]/u) })
    );
  });

  it('separates retryable provider failures so Runtime can apply its durable retry policy', async () => {
    const fail = vi.fn(async () => false);
    const send = vi.fn(async () => {
      throw new Error('EMAIL_PROVIDER_UNAVAILABLE');
    });
    const command = deliveryCommand({ claim: vi.fn(async () => dispatchRecord()), fail } as unknown as DeliveryRepository, send);

    await expect(command.dispatch('dispatch:one', execution())).rejects.toThrow('EMAIL_PROVIDER_UNAVAILABLE');
    expect(fail).toHaveBeenCalledWith(expect.anything(), expect.anything(), 'email.1', 1, expect.objectContaining({ kind: 'retryable', code: 'EMAIL_PROVIDER_UNAVAILABLE', message: expect.stringMatching(/[\u3400-\u9fff]/u) }));
  });

  it('degrades to the next registered strategy after recording a retryable primary failure', async () => {
    const primary = vi.fn(async () => {
      throw new Error('PRIMARY_UNAVAILABLE');
    });
    const secondary = vi.fn(async () => ({ provider: 'mail.secondary', externalId: 'mail:one' }));
    const recordFailure = vi.fn(async () => undefined);
    const complete = vi.fn(async () => undefined);
    const repository = { claim: vi.fn(async () => dispatchRecord()), recordFailure, complete } as unknown as DeliveryRepository;
    const registry = new DeliveryRegistry([
      { id: 'email', provider: 'mail.primary', priority: 10, send: primary },
      { id: 'email', provider: 'mail.secondary', priority: 20, send: secondary },
    ] as unknown as DeliveryChannel[]);
    const command = new NotificationDeliveryProcess(
      transactionManager(async () => result([])),
      repository,
      { decrypt: vi.fn(async () => 'member@example.test') } as unknown as KmsClient,
      registry
    );

    await command.dispatch('dispatch:one', execution());

    expect(recordFailure).toHaveBeenCalledWith(expect.anything(), expect.anything(), 'mail.primary', 1, expect.objectContaining({ kind: 'retryable', code: 'PRIMARY_UNAVAILABLE', message: expect.stringMatching(/[\u3400-\u9fff]/u) }));
    expect(secondary).toHaveBeenCalledOnce();
    expect(complete).toHaveBeenCalledWith(expect.anything(), expect.anything(), { provider: 'mail.secondary', externalId: 'mail:one' }, 2);
  });

  it('uses a deterministic event/template/version dedup key across outbox retries', async () => {
    const queue = queueMock();
    const repository = eventRepository(templateRecord(), queue);
    const command = eventCommand(repository);
    const event = { job: 'job:event', id: 'event:one', type: 'order.paid', payload: { member: 'member:one', order: 'O1' } };

    await command.event(event, execution());
    await command.event(event, execution());

    expect(queue).toHaveBeenCalledTimes(2);
    expect(new Set(queue.mock.calls.map((call) => call[1].idempotency))).toEqual(new Set(['event:one:template:one:4']));
  });

  it('does not queue unsubscribed marketing and defers enabled notifications through quiet hours', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-05T15:00:00Z'));
    try {
      const blockedQueue = queueMock();
      await eventCommand(eventRepository(templateRecord({ purpose: 'marketing', preference_enabled: false }), blockedQueue)).event(
        { job: 'job:event', id: 'event:blocked', type: 'order.paid', payload: { member: 'member:one', order: 'O1' } },
        execution()
      );
      expect(blockedQueue).not.toHaveBeenCalled();

      const deferredQueue = queueMock();
      await eventCommand(eventRepository(templateRecord({ quiet_start: '22:00:00', quiet_end: '07:00:00', quiet_timezone: 'Asia/Shanghai' }), deferredQueue)).event(
        { job: 'job:event', id: 'event:quiet', type: 'order.paid', payload: { member: 'member:one', order: 'O1' } },
        execution()
      );
      expect(deferredQueue.mock.calls[0]![1].availableAt).toBe('2026-09-05T23:00:00.000Z');
    } finally {
      vi.useRealTimers();
    }
  });

  it('redacts arbitrary provider text before persistence and retry propagation', async () => {
    const fail = vi.fn(async () => false);
    const send = vi.fn(async () => {
      throw new Error('send failed for member@example.test');
    });
    const command = deliveryCommand({ claim: vi.fn(async () => dispatchRecord()), fail } as unknown as DeliveryRepository, send);
    await expect(command.dispatch('dispatch:one', execution())).rejects.toThrow('NOTIFICATION_DELIVERY_FAILED');
    expect(JSON.stringify(fail.mock.calls)).not.toContain('member@example.test');
  });
});

function repositoryWith(attempt: Readonly<{ sequence: number; state: 'sending' | 'sent' | 'ambiguous'; dispatch: boolean }>) {
  const complete = vi.fn(async () => true);
  const fail = vi.fn(async () => undefined);
  const ambiguous = vi.fn(async () => undefined);
  const value = {
    challenge: vi.fn(async () => ({ purpose: 'registration', codeCiphertext: 'ciphertext-code', destinationCiphertext: 'ciphertext-destination' })),
    beginChallengeAttempt: vi.fn(async () => attempt),
    completeChallengeAttempt: complete,
    failChallengeAttempt: fail,
    ambiguousChallengeAttempt: ambiguous,
  } as unknown as DeliveryRepository;
  return { value, complete, fail, ambiguous };
}

function commandWith(repository: DeliveryRepository, kms: KmsClient, send: DeliveryChannel['send']) {
  return new NotificationDeliveryProcess(
    transactionManager(async () => result([])),
    repository,
    kms,
    new DeliveryRegistry([{ id: 'sms', send }])
  );
}

function deliveryCommand(repository: DeliveryRepository, send: DeliveryChannel['send']) {
  return new NotificationDeliveryProcess(
    transactionManager(async () => result([])),
    repository,
    { decrypt: vi.fn(async () => 'member@example.test') } as unknown as KmsClient,
    new DeliveryRegistry([{ id: 'email', send }])
  );
}

function dispatchRecord() {
  return Object.freeze({
    id: 'dispatch:one',
    scope_id: 'mall:one',
    member_id: 'member:one',
    template_id: 'template:one',
    channel: 'email' as const,
    event_type: 'order.paid',
    template_version: 4,
    provider_template: 'paid-v4',
    variable_schema: { order: 'string' as const },
    subject: '支付成功',
    body: '订单已支付',
    payload: { order: 'O1' },
    recipient_ciphertext: 'ciphertext',
    recipient_ref: null,
    purpose: 'transactional' as const,
    mandatory: false,
    attempt_sequence: 1,
    max_attempts: 5,
    preference_enabled: true,
    authorization_state: 'accepted' as const,
    consent_source: 'member' as const,
    quiet_start: null,
    quiet_end: null,
    quiet_timezone: null,
    preference_version: 1,
  });
}

function eventCommand(repository: DeliveryRepository) {
  return new NotificationDeliveryProcess(
    transactionManager(async () => result([])),
    repository,
    {} as KmsClient,
    new DeliveryRegistry([])
  );
}

function eventRepository(record: ReturnType<typeof templateRecord>, queue: ReturnType<typeof queueMock>) {
  return {
    jobScope: vi.fn(async () => 'mall:one'),
    eventTemplates: vi.fn(async () => [record]),
    queue,
    completeInbox: vi.fn(async () => undefined),
  } as unknown as DeliveryRepository;
}

function queueMock() {
  return vi.fn(async (_context: unknown, _input: QueuedDispatch) => undefined);
}

function templateRecord(
  overrides: Partial<
    Readonly<{
      purpose: 'transactional' | 'marketing';
      preference_enabled: boolean;
      quiet_start: string | null;
      quiet_end: string | null;
      quiet_timezone: string | null;
    }>
  > = {}
) {
  return Object.freeze({
    id: 'template:one',
    scope_id: 'mall:one',
    channel: 'inapp' as const,
    event_type: 'order.paid',
    version: 4,
    variable_schema: { order: 'string' as const },
    provider_template: null,
    subject: '订单 {{order}}',
    body: '已支付',
    status: 'active' as const,
    created_at: '2026-09-05T00:00:00Z',
    purpose: 'transactional' as const,
    mandatory: false,
    preference_enabled: true,
    authorization_state: 'accepted' as const,
    consent_source: 'member' as const,
    quiet_start: null,
    quiet_end: null,
    quiet_timezone: null,
    preference_version: 1,
    ...overrides,
  });
}

function execution() {
  return { scope: 'identity', trace: 'test:notification', signal: new AbortController().signal, deadline: Date.now() + 10_000 };
}
