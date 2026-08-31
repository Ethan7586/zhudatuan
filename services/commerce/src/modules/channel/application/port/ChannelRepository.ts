import type { OperationDatabase } from '../../../../foundation/application/ModuleOperations';

export interface ChannelRepository {
  enqueue(kind: 'catalogsync' | 'pricesync' | 'inventorysync' | 'statementsync' | 'fulfillment' | 'paymentrefund', scope: string, payload: Readonly<Record<string, unknown>>, priority: number, stableId?: string): Promise<void>;
}

export type ChannelRepositoryFactory = (database: OperationDatabase) => ChannelRepository;
