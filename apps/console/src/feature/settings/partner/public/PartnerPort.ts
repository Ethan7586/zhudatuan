import type { ConsoleContext } from '../../../../entity/session/ConsoleSession';
import type { PartnerChange, PartnerKind, PartnerPage } from '../model/Partner';
import type { PartnerReceipt, StoreChange, StorePage } from '../model/Store';
import type { Customer, CustomerChange, CustomerPage, CustomerQuery } from '../model/Customer';

export interface PartnerPort {
  readPartners(context: ConsoleContext, kind: PartnerKind, cursor?: string, signal?: AbortSignal): Promise<PartnerPage>;
  readStores(context: ConsoleContext, cursor?: string, signal?: AbortSignal): Promise<StorePage>;
  managePartner(context: ConsoleContext, change: PartnerChange, identity: string, signal?: AbortSignal): Promise<PartnerReceipt>;
  manageStore(context: ConsoleContext, change: StoreChange, identity: string, signal?: AbortSignal): Promise<PartnerReceipt>;
  readCustomers(context: ConsoleContext, query: CustomerQuery, signal?: AbortSignal): Promise<CustomerPage>;
  readCustomer(context: ConsoleContext, id: string, signal?: AbortSignal): Promise<Customer>;
  manageCustomer(context: ConsoleContext, change: CustomerChange, identity: string, signal?: AbortSignal): Promise<Customer>;
  createIdentity(): string;
  createReference(kind: PartnerKind | 'store'): string;
}
