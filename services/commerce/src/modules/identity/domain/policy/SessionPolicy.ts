import { DomainError } from '../../../../foundation/domain/DomainError';
export class SessionPolicy {
  readonly ttlSeconds = 43_200;
  assertAssurance(level: number): void {
    if (!Number.isSafeInteger(level) || level < 1 || level > 3) throw new DomainError('FEDERATION_CALLBACK_REJECTED');
  }
  assurance(level: number): 1 | 2 | 3 {
    this.assertAssurance(level);
    return level as 1 | 2 | 3;
  }
}
