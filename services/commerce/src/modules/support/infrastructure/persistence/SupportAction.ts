import type { OperationRequest, OperationResult } from '../../../../foundation/application/OperationRequest';
import type { SqlExecutor } from '../../../../adapter/database/PgTransactionAccess';

export type SupportAction = (request: OperationRequest, database: SqlExecutor) => Promise<OperationResult>;

export interface SupportLifecycle<TPreparation = unknown, TLoaded = undefined> {
  load?(request: OperationRequest, database: SqlExecutor): Promise<TLoaded>;
  prepare?(request: OperationRequest, loaded: TLoaded): Promise<TPreparation>;
  shortCircuit?(request: OperationRequest, preparation: TPreparation): OperationResult | undefined;
  execute(request: OperationRequest, database: SqlExecutor, preparation: TPreparation): Promise<OperationResult>;
  finalize?(request: OperationRequest, result: OperationResult, preparation: TPreparation): Promise<OperationResult>;
  discard?(request: OperationRequest, preparation: TPreparation, cause: unknown): Promise<void>;
}

export type SupportEntry = SupportAction | SupportLifecycle<unknown, unknown>;

export interface SupportPersistence {
  readonly createCase: SupportLifecycle<unknown, unknown>;
  readonly readCases: SupportEntry;
  readonly updateCase: SupportEntry;
  readonly closeCase: SupportEntry;
  readonly reopenCase: SupportEntry;
  readonly readHistory: SupportEntry;
  readonly sendMessage: SupportLifecycle<unknown, unknown>;
  readonly readMessages: SupportLifecycle<unknown, unknown>;
  readonly createAttachment: SupportLifecycle<unknown, unknown>;
  readonly manageAssignment: SupportEntry;
  readonly readAgents: SupportEntry;
  readonly manageAgent: SupportEntry;
  readonly readAccounts: SupportEntry;
  readonly manageAccount: SupportEntry;
  readonly readRules: SupportEntry;
  readonly manageRule: SupportEntry;
  readonly readSlas: SupportEntry;
  readonly manageSla: SupportEntry;
}

export function supportLifecycle<TPreparation, TLoaded = undefined>(definition: SupportLifecycle<TPreparation, TLoaded>): SupportLifecycle<TPreparation, TLoaded> {
  return definition;
}
