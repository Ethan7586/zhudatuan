import { DomainError } from '../../../../platform/error/DomainError';

export interface OrderAddressSnapshot {
  readonly recipientMasked: string;
  readonly mobileMasked: string;
  readonly addressMasked: string;
  readonly regionCode: string;
  readonly version: string;
  readonly hash: string;
}

export class OrderAddress {
  private constructor(readonly value: OrderAddressSnapshot | null) {}

  static freeze(value: OrderAddressSnapshot | null): OrderAddress {
    if (value === null) return new OrderAddress(null);
    if (!value.recipientMasked || !value.mobileMasked || !value.addressMasked || !value.regionCode || !value.version || !/^[a-f0-9]{64}$/.test(value.hash)) {
      throw new DomainError('ORDER_SNAPSHOT_INVALID');
    }
    const serialized = JSON.stringify(value).toLowerCase();
    if (serialized.includes('ciphertext') || /1[3-9]\d{9}/.test(serialized)) throw new DomainError('ORDER_SNAPSHOT_INVALID');
    return new OrderAddress(Object.freeze({ ...value }));
  }
}
