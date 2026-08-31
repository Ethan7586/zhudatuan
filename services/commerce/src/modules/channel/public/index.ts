export type { CatalogSource } from '../application/port/CatalogSource';
export type { PriceSource } from '../application/port/PriceSource';
export type { StockSource } from '../application/port/StockSource';
export type { RemoteOrderSubmitter } from '../application/port/RemoteOrderSubmitter';
export type { RemoteRefundProvider } from '../application/port/RemoteRefundProvider';
export type { StatementSource } from '../application/port/StatementSource';
export type { ProviderOperationInput } from '../ChannelOperationPort';
import type { OperationDatabase } from '../../../foundation/application/ModuleOperations';
export interface ProviderOperationPort {
  record(database: OperationDatabase, input: import('../ChannelOperationPort').ProviderOperationInput): Promise<void>;
  replayReference(database: OperationDatabase, operation: string, kind: 'order' | 'refund'): Promise<string>;
  update(
    database: OperationDatabase,
    input: Readonly<{ provider: string; kind: 'order' | 'refund'; idempotency: string; external?: string; state: 'queued' | 'processing' | 'succeeded' | 'failed' | 'unknown'; response: unknown }>
  ): Promise<void>;
}
export { FINANCE_CHANNEL_PORT, PgFinanceChannelPort, type FinanceChannelPort, type FinanceStatement } from './FinanceChannelPort';
