import { DomainError } from '../../../../platform/error/DomainError';
import { credentialSecret } from '@shop/contract/voucher';

export class CredentialSecret {
  readonly value: string;
  constructor(value: string) {
    const normalized = credentialSecret(value);
    if (normalized === null) throw new DomainError('VOUCHER_SECRET_INVALID');
    this.value = normalized;
  }
}
