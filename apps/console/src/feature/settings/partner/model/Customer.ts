import type { OperationBodyFor, OperationOutputFor } from '@shop/contract';

type CustomerDto = OperationOutputFor<'partner.customers.get'>;
type CustomerContactDto = CustomerDto['contacts'][number];
type CustomerAgreementDto = NonNullable<CustomerDto['agreement']>;
type CustomerAgreementView = Readonly<Omit<CustomerAgreementDto, 'capabilities'> & { readonly capabilities: readonly string[] }>;
export type Customer = Readonly<Omit<CustomerDto, 'contacts' | 'agreement'> & { readonly contacts: readonly Readonly<CustomerContactDto>[]; readonly agreement: CustomerAgreementView | null }>;
export interface CustomerPage {
  readonly items: readonly Customer[];
  readonly count: number;
  readonly nextCursor?: string;
}
export type CustomerKind = Customer['kind'];
export type CustomerStatus = Customer['status'];
export type CustomerCreateBody = OperationBodyFor<'PartnerCustomersCreateInput'>;
export type CustomerUpdateBody = OperationBodyFor<'PartnerCustomersUpdateInput'>;
export type CustomerContact = CustomerCreateBody['contact'];
export type CustomerAgreement = NonNullable<CustomerCreateBody['agreement']>;

export type CustomerChange =
  | Readonly<{ kind: 'create'; body: CustomerCreateBody }>
  | Readonly<{ kind: 'update'; customer: Customer; body: CustomerUpdateBody }>
  | Readonly<{ kind: 'enable' | 'disable'; customer: Customer; reason: string }>;

export interface CustomerQuery {
  readonly q?: string;
  readonly kind?: CustomerKind;
  readonly status?: CustomerStatus;
  readonly cursor?: string;
}
