import type { PartnerStatus } from './Partner';

export interface Store {
  readonly id: string;
  readonly scopeId: string;
  readonly name: string;
  readonly status: PartnerStatus;
  readonly version: number;
  readonly mallId: string | null;
  readonly regionCode: string;
  readonly serviceRadiusMeters: number | null;
  readonly addressConfigured: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface StorePage {
  readonly items: readonly Store[];
  readonly count: number;
  readonly nextCursor?: string;
}

export interface StoreChange {
  readonly id: string;
  readonly name: string;
  readonly status: PartnerStatus;
  readonly version: number;
  readonly mallId: string | null;
  readonly regionCode: string;
  readonly serviceRadiusMeters: number | null;
  readonly address?: string | null;
}

export interface PartnerReceipt {
  readonly id: string;
  readonly kind: 'supplier' | 'brand' | 'store';
  readonly version: number;
}
