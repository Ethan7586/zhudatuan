import type { ContractJsonValue, OperationOutputFor } from '@shop/contract';
import { definedOperationBodySchema, exactOperationOutput } from '@shop/contract/schema';

export const PartnerPageDtoSchema = exactOperationOutput('PartnerPartnersReadOutput');
export const PartnerDtoSchema = exactOperationOutput('PartnerPartnersManageOutput');
export const StorePageDtoSchema = exactOperationOutput('OrganizationStoresReadOutput');
export const StoreDtoSchema = exactOperationOutput('OrganizationStoresManageOutput');
export const CustomerPageDtoSchema = exactOperationOutput('PartnerCustomersListOutput');
export const CustomerDtoSchema = exactOperationOutput('PartnerCustomersGetOutput');

export type PartnerDto = OperationOutputFor<'partner.partners.read'>['items'][number];
export type StoreDto = OperationOutputFor<'organization.stores.manage'>;
export type StoreReadDto = OperationOutputFor<'organization.stores.read'>['items'][number];

export function customerBody(name: 'PartnerCustomersCreateInput' | 'PartnerCustomersUpdateInput', value: unknown): ContractJsonValue {
  const schema = definedOperationBodySchema(name);
  if (schema === undefined) throw new Error('CUSTOMER_BODY_SCHEMA_MISSING');
  return schema.parse(value);
}
