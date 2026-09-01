import type { ReadTransactionContext, WriteTransactionContext } from '../../../foundation/persistence/TransactionContext';
import { publicPort } from '../../../bootstrap/ModuleRegistry';
import type { JobProcessor } from '../../../foundation/application/JobRunner';
import type { ChannelCatalogPort } from '../../catalog/public';
import type { ChannelPricingPort } from '../../pricing/public';
import type { ChannelInventoryPort } from '../../inventory/public';
import type { ChannelReconciliationPort } from '../../finance/public';
import type { ExtensionStateSink } from '../../extension/public';
export type { CatalogSource } from '../application/port/CatalogSource';
export type { PriceSource } from '../application/port/PriceSource';
export type { StockSource } from '../application/port/StockSource';
export type { RemoteOrderSubmitter } from '../application/port/RemoteOrderSubmitter';
export type { RemoteRefundProvider } from '../application/port/RemoteRefundProvider';
export type { StatementSource } from '../application/port/StatementSource';
export type { ProviderOperationInput } from './ProviderOperation';

export interface ProviderOperationPort {
  record(context: WriteTransactionContext, input: import('./ProviderOperation').ProviderOperationInput): Promise<void>;
  replayReference(context: ReadTransactionContext, operation: string, kind: 'order' | 'refund'): Promise<string>;
  update(
    context: WriteTransactionContext,
    input: Readonly<{ provider: string; kind: 'order' | 'refund'; idempotency: string; external?: string; state: 'queued' | 'processing' | 'succeeded' | 'failed' | 'unknown'; response: unknown }>
  ): Promise<void>;
}
export interface ProviderSyncPort {
  catalog(catalog: ChannelCatalogPort): JobProcessor;
  price(catalog: ChannelCatalogPort, pricing: ChannelPricingPort): JobProcessor;
  inventory(catalog: ChannelCatalogPort, inventory: ChannelInventoryPort): JobProcessor;
  statement(finance: ChannelReconciliationPort): JobProcessor;
}
export const PAYMENT_CHANNEL_PORT = publicPort<ProviderOperationPort>('channel', 'payment');
export const FULFILLMENT_CHANNEL_PORT = publicPort<ProviderOperationPort>('channel', 'fulfillment');
export const PROVIDER_SYNC_PORT = publicPort<ProviderSyncPort>('channel', 'providersync');
export const EXTENSION_STATE_PORT = publicPort<ExtensionStateSink>('channel', 'extensionstate');
export { FINANCE_CHANNEL_PORT, type FinanceChannelPort, type FinanceStatement } from './FinanceChannelPort';
