import type { OperationRequest, OperationResult } from '../../../../foundation/application/OperationRequest';
import type { SqlExecutor } from '../../../../adapter/database/PgTransactionAccess';

export type VoucherAction = (request: OperationRequest, database: SqlExecutor) => Promise<OperationResult>;

export interface VoucherLifecycle<TPreparation = unknown, TLoaded = undefined> {
  load?(request: OperationRequest, database: SqlExecutor): Promise<TLoaded>;
  prepare?(request: OperationRequest, loaded: TLoaded): Promise<TPreparation>;
  shortCircuit?(request: OperationRequest, preparation: TPreparation): OperationResult | undefined;
  execute(request: OperationRequest, database: SqlExecutor, preparation: TPreparation): Promise<OperationResult>;
  finalize?(request: OperationRequest, result: OperationResult, preparation: TPreparation): Promise<OperationResult>;
  discard?(request: OperationRequest, preparation: TPreparation, cause: unknown): Promise<void>;
}

export type VoucherEntry = VoucherAction | VoucherLifecycle<unknown, unknown>;

export interface VoucherPersistence {
  readonly read: VoucherEntry;
  readonly create: VoucherEntry;
  readonly allocate: VoucherEntry;
  readonly readImport: VoucherEntry;
  readonly readPrograms: VoucherEntry;
  readonly manageProgram: VoucherEntry;
  readonly readReserves: VoucherEntry;
  readonly requestReserve: VoucherEntry;
  readonly decideReserve: VoucherEntry;
  readonly readBatches: VoucherEntry;
  readonly issueBatch: VoucherEntry;
  readonly retryBatch: VoucherEntry;
  readonly changeStatus: VoucherEntry;
  readonly readStatusBatches: VoucherEntry;
  readonly readBindings: VoucherEntry;
  readonly manageBinding: VoucherEntry;
  readonly readRedemptions: VoucherEntry;
  readonly reverseRedemption: VoucherEntry;
  readonly readHistory: VoucherEntry;
}

export function voucherLifecycle<TPreparation, TLoaded = undefined>(definition: VoucherLifecycle<TPreparation, TLoaded>): VoucherLifecycle<TPreparation, TLoaded> {
  return definition;
}
