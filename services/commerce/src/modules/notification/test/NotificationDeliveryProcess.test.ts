import { describe, expect, it, vi } from 'vitest';
import type { KmsClient } from '../../../foundation/infrastructure/KmsClient';
import { DeliveryRegistry } from '../infrastructure/registry/DeliveryRegistry';
import type { DeliveryRepository } from '../application/port/DeliveryRepository';
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

function execution() {
  return { scope: 'identity', trace: 'test:notification', signal: new AbortController().signal, deadline: Date.now() + 10_000 };
}
