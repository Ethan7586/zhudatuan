import { DomainError } from '../../../../platform/error/DomainError';
export class SessionPolicy {
  constructor(readonly ttlSeconds: number) {
    if (!Number.isSafeInteger(ttlSeconds) || ttlSeconds < 300 || ttlSeconds > 43_200) throw new Error('SESSION_POLICY_INVALID');
  }
  assertAssurance(level: number): void {
    if (!Number.isSafeInteger(level) || level < 1 || level > 3) throw new DomainError('FEDERATION_CALLBACK_REJECTED');
  }
  assurance(level: number): 1 | 2 | 3 {
    this.assertAssurance(level);
    return level as 1 | 2 | 3;
  }
}
