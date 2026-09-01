import { type SqlExecutor } from '../../../../adapter/database/PgTransactionAccess';
import type { OperationId, OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { ModuleContext } from '../../../../bootstrap/ModuleRegistry';
import type { ExecutionContext } from '../../../../foundation/application/HandlerContext';
import type { OperationReply, OperationRequest, OperationResult } from '../../../../foundation/application/OperationHandler';

import type { ReadTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { BatchRepository } from '../../application/port/BatchRepository';
import type { CardLibraryRepository } from '../../application/port/CardLibraryRepository';
import type { ImportRepository } from '../../application/port/ImportRepository';
import type { ProgramRepository } from '../../application/port/ProgramRepository';
import type { ReserveRepository } from '../../application/port/ReserveRepository';
import type { VoucherRepository } from '../../application/port/VoucherRepository';
import { voucherPersistence } from './VoucherPersistence';
import type { VoucherEntry, VoucherPersistence } from './VoucherAction';

export class PgVoucherRepository implements CardLibraryRepository, ImportRepository, ProgramRepository, ReserveRepository, BatchRepository, VoucherRepository {
  private readonly persistence: VoucherPersistence;

  constructor(
    private readonly transactions: PgTransactionAccess,
    context: ModuleContext
  ) {
    this.persistence = voucherPersistence(context);
  }

  read(transaction: ReadTransactionContext, input: OperationInputFor<'voucher.cardlibraries.read'>, context: ExecutionContext<'voucher.cardlibraries.read'>) {
    return this.execute(this.persistence.read, 'voucher.cardlibraries.read', transaction, input, context);
  }
  create(transaction: ReadTransactionContext, input: OperationInputFor<'voucher.cardlibraries.create'>, context: ExecutionContext<'voucher.cardlibraries.create'>) {
    return this.execute(this.persistence.create, 'voucher.cardlibraries.create', transaction, input, context);
  }
  allocate(transaction: ReadTransactionContext, input: OperationInputFor<'voucher.cardlibraries.allocate'>, context: ExecutionContext<'voucher.cardlibraries.allocate'>) {
    return this.execute(this.persistence.allocate, 'voucher.cardlibraries.allocate', transaction, input, context);
  }
  readImport(transaction: ReadTransactionContext, input: OperationInputFor<'voucher.imports.read'>, context: ExecutionContext<'voucher.imports.read'>) {
    return this.execute(this.persistence.readImport, 'voucher.imports.read', transaction, input, context);
  }
  readPrograms(transaction: ReadTransactionContext, input: OperationInputFor<'voucher.programs.read'>, context: ExecutionContext<'voucher.programs.read'>) {
    return this.execute(this.persistence.readPrograms, 'voucher.programs.read', transaction, input, context);
  }
  manageProgram(transaction: ReadTransactionContext, input: OperationInputFor<'voucher.programs.manage'>, context: ExecutionContext<'voucher.programs.manage'>) {
    return this.execute(this.persistence.manageProgram, 'voucher.programs.manage', transaction, input, context);
  }
  readReserves(transaction: ReadTransactionContext, input: OperationInputFor<'voucher.reserves.read'>, context: ExecutionContext<'voucher.reserves.read'>) {
    return this.execute(this.persistence.readReserves, 'voucher.reserves.read', transaction, input, context);
  }
  requestReserve(transaction: ReadTransactionContext, input: OperationInputFor<'voucher.reserves.request'>, context: ExecutionContext<'voucher.reserves.request'>) {
    return this.execute(this.persistence.requestReserve, 'voucher.reserves.request', transaction, input, context);
  }
  decideReserve(transaction: ReadTransactionContext, input: OperationInputFor<'voucher.reserves.decide'>, context: ExecutionContext<'voucher.reserves.decide'>) {
    return this.execute(this.persistence.decideReserve, 'voucher.reserves.decide', transaction, input, context);
  }
  readBatches(transaction: ReadTransactionContext, input: OperationInputFor<'voucher.batches.read'>, context: ExecutionContext<'voucher.batches.read'>) {
    return this.execute(this.persistence.readBatches, 'voucher.batches.read', transaction, input, context);
  }
  issueBatch(transaction: ReadTransactionContext, input: OperationInputFor<'voucher.batches.issue'>, context: ExecutionContext<'voucher.batches.issue'>) {
    return this.execute(this.persistence.issueBatch, 'voucher.batches.issue', transaction, input, context);
  }
  retryBatch(transaction: ReadTransactionContext, input: OperationInputFor<'voucher.batches.retry'>, context: ExecutionContext<'voucher.batches.retry'>) {
    return this.execute(this.persistence.retryBatch, 'voucher.batches.retry', transaction, input, context);
  }
  changeStatus(transaction: ReadTransactionContext, input: OperationInputFor<'voucher.status.batch'>, context: ExecutionContext<'voucher.status.batch'>) {
    return this.execute(this.persistence.changeStatus, 'voucher.status.batch', transaction, input, context);
  }
  readStatusBatches(transaction: ReadTransactionContext, input: OperationInputFor<'voucher.statusbatches.read'>, context: ExecutionContext<'voucher.statusbatches.read'>) {
    return this.execute(this.persistence.readStatusBatches, 'voucher.statusbatches.read', transaction, input, context);
  }
  readBindings(transaction: ReadTransactionContext, input: OperationInputFor<'voucher.bindings.read'>, context: ExecutionContext<'voucher.bindings.read'>) {
    return this.execute(this.persistence.readBindings, 'voucher.bindings.read', transaction, input, context);
  }
  manageBinding(transaction: ReadTransactionContext, input: OperationInputFor<'voucher.bindings.manage'>, context: ExecutionContext<'voucher.bindings.manage'>) {
    return this.execute(this.persistence.manageBinding, 'voucher.bindings.manage', transaction, input, context);
  }
  readRedemptions(transaction: ReadTransactionContext, input: OperationInputFor<'voucher.redemptions.read'>, context: ExecutionContext<'voucher.redemptions.read'>) {
    return this.execute(this.persistence.readRedemptions, 'voucher.redemptions.read', transaction, input, context);
  }
  reverseRedemption(transaction: ReadTransactionContext, input: OperationInputFor<'voucher.redemptions.reverse'>, context: ExecutionContext<'voucher.redemptions.reverse'>) {
    return this.execute(this.persistence.reverseRedemption, 'voucher.redemptions.reverse', transaction, input, context);
  }
  readHistory(transaction: ReadTransactionContext, input: OperationInputFor<'voucher.history.read'>, context: ExecutionContext<'voucher.history.read'>) {
    return this.execute(this.persistence.readHistory, 'voucher.history.read', transaction, input, context);
  }

  private async execute<TKey extends OperationId>(
    action: VoucherEntry,
    operation: TKey,
    transaction: ReadTransactionContext,
    input: OperationInputFor<TKey>,
    context: ExecutionContext<TKey>
  ): Promise<OperationReply<OperationOutputFor<TKey>>> {
    const database = this.transactions.database(transaction);
    const request = operationRequest(operation, input, context);
    if (typeof action === 'function') return asReply(await action(request, database));
    const loaded = action.load ? await action.load(request, database) : undefined;
    const prepared = action.prepare ? await action.prepare(request, loaded) : loaded;
    const immediate = action.shortCircuit?.(request, prepared);
    if (immediate) return asReply(immediate);
    try {
      const result = await action.execute(request, database, prepared);
      return asReply(action.finalize ? await action.finalize(request, result, prepared) : result);
    } catch (cause) {
      await action.discard?.(request, prepared, cause);
      throw cause;
    }
  }
}

function operationRequest<TKey extends OperationId>(type: TKey, input: OperationInputFor<TKey>, context: ExecutionContext<TKey>): OperationRequest {
  const wire = input as Readonly<{ path?: Readonly<Record<string, string>>; query?: Readonly<Record<string, string | readonly string[]>>; body?: unknown }>;
  return {
    type,
    input: {
      path: wire.path ?? {},
      query: wire.query ?? {},
      headers: context.headers,
      body: wire.body,
      rawBody: context.rawBody,
      deadline: context.deadline,
      signal: context.signal,
      ...(context.publicActor === undefined ? {} : { publicActor: context.publicActor }),
      ...(context.idempotencyKey === undefined ? {} : { idempotency: context.idempotencyKey }),
      ...(context.expectedVersion === undefined ? {} : { expectedVersion: context.expectedVersion }),
    },
    security: context.security,
  };
}

function asReply<TOutput>(result: OperationResult): OperationReply<TOutput> {
  return {
    status: result.status,
    body: result.body as TOutput,
    ...(result.headers === undefined ? {} : { headers: result.headers }),
  };
}
