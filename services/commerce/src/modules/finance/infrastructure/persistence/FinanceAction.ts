import type { OperationRequest, OperationResult } from '../../../../foundation/application/OperationRequest';
import type { SqlExecutor } from '../../../../adapter/database/PgTransactionAccess';

export type FinanceAction = (request: OperationRequest, database: SqlExecutor) => Promise<OperationResult>;

export interface FinanceLifecycle<TPreparation = unknown, TLoaded = undefined> {
  load?(request: OperationRequest, database: SqlExecutor): Promise<TLoaded>;
  prepare?(request: OperationRequest, loaded: TLoaded): Promise<TPreparation>;
  shortCircuit?(request: OperationRequest, preparation: TPreparation): OperationResult | undefined;
  execute(request: OperationRequest, database: SqlExecutor, preparation: TPreparation): Promise<OperationResult>;
  finalize?(request: OperationRequest, result: OperationResult, preparation: TPreparation): Promise<OperationResult>;
  discard?(request: OperationRequest, preparation: TPreparation, cause: unknown): Promise<void>;
}

export type FinanceEntry = FinanceAction | FinanceLifecycle<unknown, unknown>;

export interface FinancePersistence {
  readonly overviewRead: FinanceEntry;
  readonly entriesRead: FinanceEntry;
  readonly statementsRead: FinanceEntry;
  readonly statementsExport: FinanceEntry;
  readonly reconciliationsManage: FinanceEntry;
  readonly reconciliationsRead: FinanceEntry;
  readonly settlementsRead: FinanceEntry;
  readonly settlementsDecide: FinanceEntry;
  readonly settlementsAdjust: FinanceEntry;
  readonly withdrawalsRead: FinanceEntry;
  readonly withdrawalsCreate: FinanceEntry;
  readonly withdrawalsDecide: FinanceEntry;
  readonly withdrawalsRecover: FinanceEntry;
  readonly holdsRead: FinanceEntry;
  readonly periodsRead: FinanceEntry;
  readonly periodsManage: FinanceEntry;
  readonly backfillsRead: FinanceEntry;
  readonly backfillsDecide: FinanceEntry;
  readonly policiesManage: FinanceEntry;
  readonly invoicesRead: FinanceEntry;
  readonly invoicesDownload: FinanceEntry;
  readonly profilesManage: FinanceEntry;
  readonly profilesRead: FinanceEntry;
  readonly requestsCreate: FinanceEntry;
  readonly requestsRead: FinanceEntry;
  readonly requestsCancel: FinanceEntry;
  readonly requestsDecide: FinanceEntry;
  readonly redInvoice: FinanceEntry;
  readonly policiesRead: FinanceEntry;
  readonly policiesPreview: FinanceEntry;
  readonly repairsRead: FinanceEntry;
  readonly repairsPreview: FinanceEntry;
  readonly repairsSubmit: FinanceEntry;
  readonly repairsDecide: FinanceEntry;
  readonly repairsReverse: FinanceEntry;
}

export function financeLifecycle<TPreparation, TLoaded = undefined>(definition: FinanceLifecycle<TPreparation, TLoaded>): FinanceLifecycle<TPreparation, TLoaded> {
  return definition;
}
