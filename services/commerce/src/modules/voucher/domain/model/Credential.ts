import { DomainError } from '../../../../foundation/domain/DomainError';

export type CredentialState = 'generated' | 'available' | 'allocated' | 'void';
export interface CredentialValue { readonly id: string; readonly pool: string; readonly product: string; readonly fingerprint: string; readonly keyVersion: string; readonly state: CredentialState; readonly issueBatch: string | null; readonly version: number; }
export class Credential {
  constructor(readonly value: CredentialValue) {
    if (!value.id || !value.pool || !value.product || !/^[0-9a-f]{64}$/.test(value.fingerprint) || !value.keyVersion) throw new DomainError('VOUCHER_CREDENTIAL_CONFLICT');
    if ((value.state === 'allocated') !== (value.issueBatch !== null)) throw new DomainError('VOUCHER_CREDENTIAL_CONFLICT');
  }
  available(): Credential { return this.move('available', null, ['generated']); }
  allocate(batch: string): Credential { return this.move('allocated', batch, ['available']); }
  void(): Credential { return this.move('void', null, ['generated', 'available']); }
  private move(state: CredentialState, issueBatch: string | null, from: CredentialState[]): Credential {
    if (!from.includes(this.value.state)) throw new DomainError('VOUCHER_STATE_INVALID');
    return new Credential(Object.freeze({ ...this.value, state, issueBatch, version: this.value.version + 1 }));
  }
}
