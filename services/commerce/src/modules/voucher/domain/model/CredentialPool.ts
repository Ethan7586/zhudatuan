import { DomainError } from '../../../../platform/error/DomainError';
import { PoolPolicy } from '../policy/PoolPolicy';

export interface CredentialPoolValue {
  readonly id: string;
  readonly scope: string;
  readonly product: string;
  readonly name: string;
  readonly mode: 'generated' | 'imported';
  readonly prefix: string;
  readonly capacity: number;
  readonly generated: number;
  readonly state: 'open' | 'closed';
  readonly version: number;
}
export class CredentialPool {
  constructor(readonly value: CredentialPoolValue) {
    new PoolPolicy().validate(value);
  }
  reserve(count: number): CredentialPool {
    new PoolPolicy().reserve(this.value, count);
    return new CredentialPool(Object.freeze({ ...this.value, generated: this.value.generated + count, version: this.value.version + 1 }));
  }
  close(): CredentialPool {
    if (this.value.state !== 'open') throw new DomainError('VOUCHER_POOL_CLOSED');
    return new CredentialPool(Object.freeze({ ...this.value, state: 'closed', version: this.value.version + 1 }));
  }
}
