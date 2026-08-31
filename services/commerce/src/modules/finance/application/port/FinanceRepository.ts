import type { OperationDatabase } from '../../../../foundation/application/ModuleOperations';

export interface FinanceRepository {
  enqueue(kind: 'reconciliation' | 'settlement' | 'invoice', scope: string, payload: unknown, id: string, replay?: boolean, priority?: number): Promise<void>;
  event(type: string, aggregateType: string, aggregate: string, scope: string, payload: unknown, stableId?: string): Promise<void>;
}

export type FinanceRepositoryFactory = (database: OperationDatabase) => FinanceRepository;
