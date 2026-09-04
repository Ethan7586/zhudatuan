import { exactOperationOutput } from '@shop/contract/schema';

export const PartnerPageDtoSchema = exactOperationOutput('PartnerPartnersReadOutput');
export const PartnerDtoSchema = exactOperationOutput('PartnerPartnersManageOutput');
export const StorePageDtoSchema = exactOperationOutput('OrganizationStoresReadOutput');
export const StoreDtoSchema = exactOperationOutput('OrganizationStoresManageOutput');

export interface QualificationDto {
  readonly valid: number;
  readonly pending: number;
  readonly rejected: number;
  readonly expired: number;
  readonly nearest_expiry: string | null;
}
export interface PartnerDto {
  readonly id: string;
  readonly scope_id: string;
  readonly kind: 'supplier' | 'brand' | 'store';
  readonly name: string;
  readonly status: 'pending' | 'active' | 'suspended' | 'terminated';
  readonly version: number;
  readonly qualification: QualificationDto;
  readonly created_at: string;
  readonly updated_at: string;
}
export interface StoreDto {
  readonly id: string;
  readonly scope: string;
  readonly name: string;
  readonly status: 'pending' | 'active' | 'suspended' | 'terminated';
  readonly version: number;
  readonly mall: string | null;
  readonly regionCode: string;
  readonly serviceRadiusMeters: number | null;
  readonly addressConfigured: boolean;
  readonly createdAt?: string;
  readonly updatedAt?: string;
}
