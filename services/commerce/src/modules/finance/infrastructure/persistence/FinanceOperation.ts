import type { OperationRequest, OperationResult } from '../../../../pipeline/OperationRequest';
import type { SqlExecutor } from '../../../../platform/database/PgTransactionAccess';
import type { ReadTransactionContext } from '../../../../platform/database/TransactionContext';

export interface FinanceRequest extends OperationRequest {
  readonly transaction: ReadTransactionContext;
}

export type FinanceAction = (request: FinanceRequest, database: SqlExecutor) => Promise<OperationResult>;

export interface FinanceLifecycle<TPreparation = unknown, TLoaded = undefined> {
  load?(request: FinanceRequest, database: SqlExecutor): Promise<TLoaded>;
  prepare?(request: FinanceRequest, loaded: TLoaded): Promise<TPreparation>;
  shortCircuit?(request: FinanceRequest, preparation: TPreparation): OperationResult | undefined;
  execute(request: FinanceRequest, database: SqlExecutor, preparation: TPreparation): Promise<OperationResult>;
  finalize?(request: FinanceRequest, result: OperationResult, preparation: TPreparation): Promise<OperationResult>;
  discard?(request: FinanceRequest, preparation: TPreparation, cause: unknown): Promise<void>;
}

export type FinanceEntry = FinanceAction | FinanceLifecycle<unknown, unknown>;
export type FinanceEntries<TKey extends string> = Readonly<Record<TKey, FinanceEntry>>;

export function financeLifecycle<TPreparation, TLoaded = undefined>(definition: FinanceLifecycle<TPreparation, TLoaded>): FinanceLifecycle<TPreparation, TLoaded> {
  return definition;
}
