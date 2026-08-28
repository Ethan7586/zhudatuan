import type { QueryResult } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import type { KmsClient } from '../../../../foundation/infrastructure/KmsClient';
import { DeliveryRegistry } from '../DeliveryRegistry';
import type { NotificationRepository } from '../port/NotificationRepository';
import { DispatchNotification } from './DispatchNotification';

const challenge = 'challenge:00000000-0000-4000-8000-000000000001';

describe('identity challenge notification delivery safety', () => {
  it('does not decrypt or send a terminal sent/ambiguous attempt', async () => {
    const repository = repositoryWith({ sequence: 1, state: 'sent', dispatch: false });
    const decrypt = vi.fn(async () => 'unused');
    const send = vi.fn(async () => ({ provider: 'aliyun', externalId: 'sms:1' }));
    const command = new DispatchNotification(repository.value, { decrypt } as unknown as KmsClient,
      new DeliveryRegistry([{ id: 'sms', send }]));

    await command.challenge(challenge);

    expect(decrypt).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
    expect(repository.complete).not.toHaveBeenCalled();
    expect(repository.ambiguous).not.toHaveBeenCalled();
  });

  it('persists sent only after provider receipt is returned', async () => {
    const repository = repositoryWith({ sequence: 2, state: 'sending', dispatch: true });
    const decrypt = vi.fn(async (key: string) => key === 'identity/challenge' ? '123456' : '+8613800138000');
    const send = vi.fn(async () => ({ provider: 'aliyun', externalId: 'sms:2' }));
    const command = new DispatchNotification(repository.value, { decrypt } as unknown as KmsClient,
      new DeliveryRegistry([{ id: 'sms', send }]));

    await command.challenge(challenge);

    expect(send).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      recipient: '+8613800138000', variables: { code: '123456' }, idempotency: challenge,
    }));
    expect(repository.complete).toHaveBeenCalledExactlyOnceWith(challenge, 2, 'aliyun', 'sms:2');
    expect(repository.ambiguous).not.toHaveBeenCalled();
  });

  it('marks provider or commit uncertainty ambiguous and never blindly resends it', async () => {
    const repository = repositoryWith({ sequence: 3, state: 'sending', dispatch: true });
    const decrypt = vi.fn(async (key: string) => key === 'identity/challenge' ? '123456' : '+8613800138000');
    const send = vi.fn(async () => { throw new Error('PROVIDER_OUTCOME_UNKNOWN'); });
    const command = new DispatchNotification(repository.value, { decrypt } as unknown as KmsClient,
      new DeliveryRegistry([{ id: 'sms', send }]));

    await expect(command.challenge(challenge)).resolves.toBeUndefined();
    expect(repository.ambiguous).toHaveBeenCalledExactlyOnceWith(challenge, 3, 'PROVIDER_OUTCOME_UNKNOWN');
    expect(repository.fail).not.toHaveBeenCalled();
  });

  it('records a pre-send decrypt failure as failed and allows the job to retry', async () => {
    const repository = repositoryWith({ sequence: 4, state: 'sending', dispatch: true });
    const decrypt = vi.fn(async () => { throw new Error('KMS_DECRYPT_FAILED'); });
    const send = vi.fn(async () => ({ provider: 'aliyun', externalId: 'sms:4' }));
    const command = new DispatchNotification(repository.value, { decrypt } as unknown as KmsClient,
      new DeliveryRegistry([{ id: 'sms', send }]));

    await expect(command.challenge(challenge)).rejects.toThrow('KMS_DECRYPT_FAILED');
    expect(repository.fail).toHaveBeenCalledExactlyOnceWith(challenge, 4, 'KMS_DECRYPT_FAILED');
    expect(send).not.toHaveBeenCalled();
  });
});

function repositoryWith(attempt: Readonly<{ sequence: number; state: 'sending' | 'sent' | 'ambiguous'; dispatch: boolean }>) {
  const complete = vi.fn(async () => result([{}]));
  const fail = vi.fn(async () => result([{}]));
  const ambiguous = vi.fn(async () => result([{}]));
  const value = {
    challenge: vi.fn(async () => result([{ purpose: 'registration', code_ciphertext: 'ciphertext-code',
      destination_ciphertext: 'ciphertext-destination' }])),
    beginChallengeAttempt: vi.fn(async () => result([attempt])),
    completeChallengeAttempt: complete,
    failChallengeAttempt: fail,
    ambiguousChallengeAttempt: ambiguous,
  } as unknown as NotificationRepository;
  return { value, complete, fail, ambiguous };
}

function result<T extends Record<string, unknown>>(rows: readonly T[]): QueryResult<T> {
  return { rows, rowCount: rows.length } as unknown as QueryResult<T>;
}
