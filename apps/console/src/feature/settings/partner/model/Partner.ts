import type { PartnerQualification } from './Qualification';

export type PartnerKind = 'supplier' | 'brand';
export type PartnerStatus = 'pending' | 'active' | 'suspended' | 'terminated';

export interface Partner {
  readonly id: string;
  readonly scopeId: string;
  readonly kind: PartnerKind;
  readonly name: string;
  readonly status: PartnerStatus;
  readonly version: number;
  readonly qualification: PartnerQualification;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface PartnerPage {
  readonly items: readonly Partner[];
  readonly count: number;
  readonly nextCursor?: string;
}

export interface PartnerChange {
  readonly id: string;
  readonly kind: PartnerKind;
  readonly name: string;
  readonly status: PartnerStatus;
  readonly version: number;
}
