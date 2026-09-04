import type { ReadTransactionContext } from '../../../../foundation/persistence/TransactionContext';

export interface FinanceFacetCount {
  readonly value: string;
  readonly count: number;
}

export interface FinanceFacetSnapshot {
  readonly periods: readonly FinanceFacetCount[];
  readonly providers: readonly FinanceFacetCount[];
  readonly malls: readonly FinanceFacetCount[];
  readonly states: readonly FinanceFacetCount[];
  readonly differenceTypes: readonly FinanceFacetCount[];
  readonly watermark: string | null;
}

export interface FacetRepository {
  read(context: ReadTransactionContext, scopes: readonly string[]): Promise<FinanceFacetSnapshot>;
}
