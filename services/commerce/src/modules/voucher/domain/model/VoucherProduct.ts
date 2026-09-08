import { DomainError } from '../../../../platform/error/DomainError';
import { ProductPolicy, type ProductConfiguration } from '../policy/ProductPolicy';

export type VoucherProductState = 'draft' | 'enabled' | 'disabled' | 'retired';
export interface VoucherProductValue extends ProductConfiguration {
  readonly id: string;
  readonly scope: string;
  readonly state: VoucherProductState;
  readonly version: number;
}
export class VoucherProduct {
  constructor(readonly value: VoucherProductValue) {
    new ProductPolicy().validate(value);
  }
  revise(configuration: ProductConfiguration): VoucherProduct {
    if (this.value.state === 'retired') throw new DomainError('VOUCHER_STATE_INVALID');
    return new VoucherProduct(Object.freeze({ ...this.value, ...configuration, state: this.value.state === 'enabled' ? 'disabled' : this.value.state, version: this.value.version + 1 }));
  }
  enable(now: Date): VoucherProduct {
    new ProductPolicy().enable(this.value, now);
    return new VoucherProduct(Object.freeze({ ...this.value, state: 'enabled', version: this.value.version + 1 }));
  }
  disable(): VoucherProduct {
    if (this.value.state !== 'enabled') throw new DomainError('VOUCHER_STATE_INVALID');
    return new VoucherProduct(Object.freeze({ ...this.value, state: 'disabled', version: this.value.version + 1 }));
  }
}
