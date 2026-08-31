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
  readonly status: 'active' | 'deleted';
}

export interface AddressDraft {
  readonly recipient: string;
  readonly mobile: string;
  readonly province: string;
  readonly city: string;
  readonly district: string;
  readonly detail: string;
}
