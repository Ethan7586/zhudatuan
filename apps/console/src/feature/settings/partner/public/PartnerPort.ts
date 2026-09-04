import type { ConsoleContext } from '../../../../entity/session/ConsoleSession';
import type { PartnerChange, PartnerKind, PartnerPage } from '../model/Partner';
import type { PartnerReceipt, StoreChange, StorePage } from '../model/Store';

export interface PartnerPort {
  readPartners(context: ConsoleContext, kind: PartnerKind, cursor?: string, signal?: AbortSignal): Promise<PartnerPage>;
  readStores(context: ConsoleContext, cursor?: string, signal?: AbortSignal): Promise<StorePage>;
  managePartner(context: ConsoleContext, change: PartnerChange, identity: string, signal?: AbortSignal): Promise<PartnerReceipt>;
  manageStore(context: ConsoleContext, change: StoreChange, identity: string, signal?: AbortSignal): Promise<PartnerReceipt>;
  createIdentity(): string;
  createReference(kind: PartnerKind | 'store'): string;
}
