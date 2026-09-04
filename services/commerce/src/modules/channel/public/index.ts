import type { ReadTransactionContext, WriteTransactionContext } from '../../../foundation/persistence/TransactionContext';
import { publicPort } from '../../../bootstrap/ModuleRegistry';
import type { JobDeadletter, JobProcessor } from '../../runtime/public/JobProcess';
import type { ChannelCatalogPort } from '../../catalog/public';
import type { ChannelPricingPort } from '../../pricing/public';
import type { ChannelInventoryPort } from '../../inventory/public';
import type { ChannelReconciliationPort } from '../../finance/public';
import type { ExtensionStateSink } from '../../extension/public';
export type { CatalogSource, PriceSource, StockSource, RemoteOrderSubmitter, RemoteRefundProvider, StatementSource } from '@shop/contract';
export type { ProviderOperationInput, ProviderOperationUpdate } from './ProviderOperation';
export type { ChannelWebhookEvent, ChannelWebhookState } from './ChannelWebhookEvent';

export interface ProviderOperationPort {
  record(context: WriteTransactionContext, input: import('./ProviderOperation').ProviderOperationInput): Promise<void>;
  replayReference(context: ReadTransactionContext, operation: string, kind: 'order' | 'refund'): Promise<string>;
  update(context: WriteTransactionContext, input: import('./ProviderOperation').ProviderOperationUpdate): Promise<void>;
}
export interface ProviderSyncPort {
  catalog(catalog: ChannelCatalogPort): ProviderSyncJob;
  price(catalog: ChannelCatalogPort, pricing: ChannelPricingPort): ProviderSyncJob;
  inventory(catalog: ChannelCatalogPort, inventory: ChannelInventoryPort): ProviderSyncJob;
  statement(finance: ChannelReconciliationPort): ProviderSyncJob;
}
export interface ProviderSyncJob extends JobProcessor, JobDeadletter {}
export const PAYMENT_CHANNEL_PORT = publicPort<ProviderOperationPort>('channel', 'payment');
export const FULFILLMENT_CHANNEL_PORT = publicPort<ProviderOperationPort>('channel', 'fulfillment');
export const PROVIDER_SYNC_PORT = publicPort<ProviderSyncPort>('channel', 'providersync');
export const EXTENSION_STATE_PORT = publicPort<ExtensionStateSink>('channel', 'extensionstate');
export { FINANCE_CHANNEL_PORT, type ChannelProviderAvailability, type ChannelStatement, type FinanceChannelPort } from './FinanceChannelPort';
