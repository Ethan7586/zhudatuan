import { type SqlExecutor } from '../../../../adapter/database/PgTransactionAccess';
import type { OperationId, OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { ModuleContext } from '../../../../bootstrap/ModuleRegistry';
import type { ExecutionContext } from '../../../../foundation/application/HandlerContext';
import type { OperationReply, OperationRequest, OperationResult } from '../../../../foundation/application/OperationHandler';

import type { ReadTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { AccountRepository, FinanceRepositoryMethod, InvoiceRepository, JournalRepository, PolicyRepository, RepairRepository, SettlementRepository, StatementRepository } from '../../application/port/OperationRepositories';
import { financePersistence } from './FinancePersistence';
import type { FinanceEntry, FinancePersistence } from './FinanceAction';

export class PgFinanceOperationRepository implements AccountRepository, InvoiceRepository, JournalRepository, PolicyRepository, RepairRepository, SettlementRepository, StatementRepository {
  private readonly persistence: FinancePersistence;
  constructor(
    private readonly transactions: PgTransactionAccess,
    context: ModuleContext
  ) {
    this.persistence = financePersistence(context);
  }

  readonly backfillsDecide: FinanceRepositoryMethod<'finance.backfills.decide'> = (transaction, input, context) => this.execute(this.persistence.backfillsDecide, transaction, input, context);
  readonly backfillsRead: FinanceRepositoryMethod<'finance.backfills.read'> = (transaction, input, context) => this.execute(this.persistence.backfillsRead, transaction, input, context);
  readonly entriesRead: FinanceRepositoryMethod<'finance.entries.read'> = (transaction, input, context) => this.execute(this.persistence.entriesRead, transaction, input, context);
  readonly holdsRead: FinanceRepositoryMethod<'finance.holds.read'> = (transaction, input, context) => this.execute(this.persistence.holdsRead, transaction, input, context);
  readonly invoicesDownload: FinanceRepositoryMethod<'finance.invoices.download'> = (transaction, input, context) => this.execute(this.persistence.invoicesDownload, transaction, input, context);
  readonly invoicesRead: FinanceRepositoryMethod<'finance.invoices.read'> = (transaction, input, context) => this.execute(this.persistence.invoicesRead, transaction, input, context);
  readonly overviewRead: FinanceRepositoryMethod<'finance.overview.read'> = (transaction, input, context) => this.execute(this.persistence.overviewRead, transaction, input, context);
  readonly periodsManage: FinanceRepositoryMethod<'finance.periods.manage'> = (transaction, input, context) => this.execute(this.persistence.periodsManage, transaction, input, context);
  readonly periodsRead: FinanceRepositoryMethod<'finance.periods.read'> = (transaction, input, context) => this.execute(this.persistence.periodsRead, transaction, input, context);
  readonly policiesManage: FinanceRepositoryMethod<'finance.policies.manage'> = (transaction, input, context) => this.execute(this.persistence.policiesManage, transaction, input, context);
  readonly policiesPreview: FinanceRepositoryMethod<'finance.policies.preview'> = (transaction, input, context) => this.execute(this.persistence.policiesPreview, transaction, input, context);
  readonly policiesRead: FinanceRepositoryMethod<'finance.policies.read'> = (transaction, input, context) => this.execute(this.persistence.policiesRead, transaction, input, context);
  readonly profilesManage: FinanceRepositoryMethod<'invoice.profiles.manage'> = (transaction, input, context) => this.execute(this.persistence.profilesManage, transaction, input, context);
  readonly profilesRead: FinanceRepositoryMethod<'invoice.profiles.read'> = (transaction, input, context) => this.execute(this.persistence.profilesRead, transaction, input, context);
  readonly reconciliationsManage: FinanceRepositoryMethod<'finance.reconciliations.manage'> = (transaction, input, context) => this.execute(this.persistence.reconciliationsManage, transaction, input, context);
  readonly reconciliationsRead: FinanceRepositoryMethod<'finance.reconciliations.read'> = (transaction, input, context) => this.execute(this.persistence.reconciliationsRead, transaction, input, context);
  readonly redInvoice: FinanceRepositoryMethod<'invoice.requests.red'> = (transaction, input, context) => this.execute(this.persistence.redInvoice, transaction, input, context);
  readonly repairsDecide: FinanceRepositoryMethod<'finance.reconciliationrepairs.decide'> = (transaction, input, context) => this.execute(this.persistence.repairsDecide, transaction, input, context);
  readonly repairsPreview: FinanceRepositoryMethod<'finance.reconciliationrepairs.preview'> = (transaction, input, context) => this.execute(this.persistence.repairsPreview, transaction, input, context);
  readonly repairsRead: FinanceRepositoryMethod<'finance.reconciliationrepairs.read'> = (transaction, input, context) => this.execute(this.persistence.repairsRead, transaction, input, context);
  readonly repairsReverse: FinanceRepositoryMethod<'finance.reconciliationrepairs.reverse'> = (transaction, input, context) => this.execute(this.persistence.repairsReverse, transaction, input, context);
  readonly repairsSubmit: FinanceRepositoryMethod<'finance.reconciliationrepairs.submit'> = (transaction, input, context) => this.execute(this.persistence.repairsSubmit, transaction, input, context);
  readonly requestsCancel: FinanceRepositoryMethod<'invoice.requests.cancel'> = (transaction, input, context) => this.execute(this.persistence.requestsCancel, transaction, input, context);
  readonly requestsCreate: FinanceRepositoryMethod<'invoice.requests.create'> = (transaction, input, context) => this.execute(this.persistence.requestsCreate, transaction, input, context);
  readonly requestsDecide: FinanceRepositoryMethod<'invoice.requests.decide'> = (transaction, input, context) => this.execute(this.persistence.requestsDecide, transaction, input, context);
  readonly requestsRead: FinanceRepositoryMethod<'invoice.requests.read'> = (transaction, input, context) => this.execute(this.persistence.requestsRead, transaction, input, context);
  readonly settlementsAdjust: FinanceRepositoryMethod<'finance.settlements.adjust'> = (transaction, input, context) => this.execute(this.persistence.settlementsAdjust, transaction, input, context);
  readonly settlementsDecide: FinanceRepositoryMethod<'finance.settlements.decide'> = (transaction, input, context) => this.execute(this.persistence.settlementsDecide, transaction, input, context);
  readonly settlementsRead: FinanceRepositoryMethod<'finance.settlements.read'> = (transaction, input, context) => this.execute(this.persistence.settlementsRead, transaction, input, context);
  readonly statementsExport: FinanceRepositoryMethod<'finance.statements.export'> = (transaction, input, context) => this.execute(this.persistence.statementsExport, transaction, input, context);
  readonly statementsRead: FinanceRepositoryMethod<'finance.statements.read'> = (transaction, input, context) => this.execute(this.persistence.statementsRead, transaction, input, context);
  readonly withdrawalsCreate: FinanceRepositoryMethod<'finance.withdrawals.create'> = (transaction, input, context) => this.execute(this.persistence.withdrawalsCreate, transaction, input, context);
  readonly withdrawalsDecide: FinanceRepositoryMethod<'finance.withdrawals.decide'> = (transaction, input, context) => this.execute(this.persistence.withdrawalsDecide, transaction, input, context);
  readonly withdrawalsRead: FinanceRepositoryMethod<'finance.withdrawals.read'> = (transaction, input, context) => this.execute(this.persistence.withdrawalsRead, transaction, input, context);
  readonly withdrawalsRecover: FinanceRepositoryMethod<'finance.withdrawals.recover'> = (transaction, input, context) => this.execute(this.persistence.withdrawalsRecover, transaction, input, context);
  private async execute<TKey extends OperationId>(action: FinanceEntry, transaction: ReadTransactionContext, input: OperationInputFor<TKey>, context: ExecutionContext<TKey>): Promise<OperationReply<OperationOutputFor<TKey>>> {
    const database = this.transactions.database(transaction);
    const request = operationRequest(context.operation, input, context);
    if (typeof action === 'function') return reply(await action(request, database));
    const loaded = action.load ? await action.load(request, database) : undefined;
    const prepared = action.prepare ? await action.prepare(request, loaded) : loaded;
    const immediate = action.shortCircuit?.(request, prepared);
    if (immediate) return reply(immediate);
    try {
      const result = await action.execute(request, database, prepared);
      return reply(action.finalize ? await action.finalize(request, result, prepared) : result);
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
function reply<T>(result: OperationResult): OperationReply<T> {
  return { status: result.status, body: result.body as T, ...(result.headers === undefined ? {} : { headers: result.headers }) };
}
