import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';

export interface DirectoryLease {
  run(scope: string, resource: string, owner: string, seconds: number, work: (assertLease: () => Promise<void>) => Promise<void>): Promise<void>;
}

export interface DirectoryAnomaly {
  readonly connection: string;
  readonly code: string;
  readonly count: number;
}

export interface DirectoryJobRepository {
  anomalies(context: ReadTransactionContext): Promise<readonly DirectoryAnomaly[]>;
  alert(context: WriteTransactionContext, anomaly: DirectoryAnomaly, date: string): Promise<void>;
}
