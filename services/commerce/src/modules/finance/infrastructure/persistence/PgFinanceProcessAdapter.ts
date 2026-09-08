import type { OperationId, OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { ExecutionContext } from '../../../../pipeline/HandlerContext';
import type { OperationReply, OperationResult } from '../../../../pipeline/OperationHandler';
import type { ReadTransactionContext } from '../../../../platform/database/TransactionContext';
import type { PgTransactionAccess } from '../../../../platform/database/PgTransactionAccess';
import type { FinanceOperation } from '../../application/port/FinanceOperation';
import type { FinanceEntry, FinanceRequest } from './FinanceOperation';

/** Transactional process adapter. It knows execution mechanics, never finance use cases. */
export class PgFinanceProcessAdapter {
  constructor(private readonly transactions: PgTransactionAccess) {}

  bind<TKey extends OperationId>(entry: FinanceEntry): FinanceOperation<TKey> {
    return (transaction, input, context) => this.execute(entry, transaction, input, context);
  }

  private async execute<TKey extends OperationId>(entry: FinanceEntry, transaction: ReadTransactionContext, input: OperationInputFor<TKey>, context: ExecutionContext<TKey>): Promise<OperationReply<OperationOutputFor<TKey>>> {
    const database = this.transactions.database(transaction);
    const request = operationRequest(context.operation, input, context, transaction);
    if (typeof entry === 'function') return reply(await entry(request, database));
    const loaded = entry.load ? await entry.load(request, database) : undefined;
    const prepared = entry.prepare ? await entry.prepare(request, loaded) : loaded;
    const immediate = entry.shortCircuit?.(request, prepared);
    if (immediate) return reply(immediate);
    try {
      const result = await entry.execute(request, database, prepared);
      return reply(entry.finalize ? await entry.finalize(request, result, prepared) : result);
    } catch (cause) {
      await entry.discard?.(request, prepared, cause);
      throw cause;
    }
  }
}

function operationRequest<TKey extends OperationId>(type: TKey, input: OperationInputFor<TKey>, context: ExecutionContext<TKey>, transaction: ReadTransactionContext): FinanceRequest {
  const wire = input as Readonly<{ path?: Readonly<Record<string, string>>; query?: Readonly<Record<string, string | readonly string[]>>; body?: unknown }>;
  return {
    type,
    transaction,
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

function reply<T>(result: OperationResult): OperationReply<T> {
  return { status: result.status, body: result.body as T, ...(result.headers === undefined ? {} : { headers: result.headers }) };
}
