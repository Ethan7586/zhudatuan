import type { PartnerQualification } from './Qualification';
import type { OperationOutputFor } from '@shop/contract';

type PartnerDto = OperationOutputFor<'partner.partners.read'>['items'][number];
export type PartnerKind = PartnerDto['kind'];
export type PartnerStatus = PartnerDto['status'];

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
