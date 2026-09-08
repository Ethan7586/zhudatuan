import { DomainError } from '../../../../platform/error/DomainError';
import { VoucherSubject } from '../value/VoucherSubject';
export interface HolderValue {
  readonly id: string;
  readonly voucher: string;
  readonly member: string;
  readonly state: 'bound' | 'released';
  readonly version: number;
}
export class Holder {
  constructor(readonly value: HolderValue) {
    if (!value.id || !value.voucher || !Number.isSafeInteger(value.version) || value.version < 1) throw new DomainError('VALIDATION_FAILED');
    new VoucherSubject('member', value.member);
  }
  release(): Holder {
    if (this.value.state !== 'bound') throw new DomainError('VOUCHER_STATE_INVALID');
    return new Holder(Object.freeze({ ...this.value, state: 'released', version: this.value.version + 1 }));
  }
}
