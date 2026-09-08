import { DomainError } from '../../../../platform/error/DomainError';
import type { CredentialPoolValue } from '../model/CredentialPool';
export class PoolPolicy {
  validate(value: CredentialPoolValue): void {
    if (!value.id || !value.scope || !value.product || !Number.isSafeInteger(value.capacity) || value.capacity <= 0 || !Number.isSafeInteger(value.generated) || value.generated < 0 || value.generated > value.capacity || value.version < 0)
      throw new DomainError('VOUCHER_CREDENTIAL_CONFLICT');
  }
  reserve(value: CredentialPoolValue, count: number): void {
    if (value.state !== 'open') throw new DomainError('VOUCHER_POOL_CLOSED');
    if (!Number.isSafeInteger(count) || count <= 0 || value.generated + count > value.capacity) throw new DomainError('VOUCHER_STOCK_INSUFFICIENT');
  }
}
