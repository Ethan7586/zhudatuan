export interface Address {
  readonly id: string;
  readonly recipient: string;
  readonly mobile: string;
  readonly province: string;
  readonly city: string;
  readonly district: string;
  readonly detail: string;
  readonly isDefault: boolean;
  readonly tag?: string;
  readonly version: number;
  readonly status: AddressDto['status'];
}

export interface AddressDraft {
  readonly recipient: string;
  readonly mobile: string;
  readonly province: string;
  readonly city: string;
  readonly district: string;
  readonly detail: string;
  readonly isDefault: boolean;
}
import type { OperationOutputFor } from '@shop/contract';

type AddressDto = OperationOutputFor<'member.addresses.read'>['items'][number];
