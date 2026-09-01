import { type SqlExecutor } from '../../../../adapter/database/PgTransactionAccess';
import type { OperationId, OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { ModuleContext } from '../../../../bootstrap/ModuleRegistry';
import type { ExecutionContext } from '../../../../foundation/application/HandlerContext';
import type { OperationReply, OperationRequest, OperationResult } from '../../../../foundation/application/OperationHandler';

import type { ReadTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { AccountRepository } from '../../application/port/AccountRepository';
import type { BudgetRepository } from '../../application/port/BudgetRepository';
import type { GrantRepository } from '../../application/port/GrantRepository';
import type { LedgerRepository } from '../../application/port/LedgerRepository';
import type { LotRepository } from '../../application/port/LotRepository';
import type { PlanRepository } from '../../application/port/PlanRepository';
import { benefitPersistence, type BenefitPersistence } from './BenefitPersistence';

type BenefitAction = (request: OperationRequest, database: SqlExecutor) => Promise<OperationResult>;

export class PgBenefitRepository implements AccountRepository, BudgetRepository, GrantRepository, LedgerRepository, LotRepository, PlanRepository {
  private readonly persistence: BenefitPersistence;
  constructor(
    private readonly transactions: PgTransactionAccess,
    context: ModuleContext
  ) {
    this.persistence = benefitPersistence(context);
  }
  readAccounts(transaction: ReadTransactionContext, input: OperationInputFor<'benefit.accounts.read'>, context: ExecutionContext<'benefit.accounts.read'>) {
    return this.execute(this.persistence.readAccounts, 'benefit.accounts.read', transaction, input, context);
  }
  readLedger(transaction: ReadTransactionContext, input: OperationInputFor<'benefit.ledgers.read'>, context: ExecutionContext<'benefit.ledgers.read'>) {
    return this.execute(this.persistence.readLedger, 'benefit.ledgers.read', transaction, input, context);
  }
  readPlans(transaction: ReadTransactionContext, input: OperationInputFor<'benefit.plans.read'>, context: ExecutionContext<'benefit.plans.read'>) {
    return this.execute(this.persistence.readPlans, 'benefit.plans.read', transaction, input, context);
  }
  managePlan(transaction: ReadTransactionContext, input: OperationInputFor<'benefit.plans.manage'>, context: ExecutionContext<'benefit.plans.manage'>) {
    return this.execute(this.persistence.managePlan, 'benefit.plans.manage', transaction, input, context);
  }
  readBudgets(transaction: ReadTransactionContext, input: OperationInputFor<'benefit.budgets.read'>, context: ExecutionContext<'benefit.budgets.read'>) {
    return this.execute(this.persistence.readBudgets, 'benefit.budgets.read', transaction, input, context);
  }
  manageBudget(transaction: ReadTransactionContext, input: OperationInputFor<'benefit.budgets.manage'>, context: ExecutionContext<'benefit.budgets.manage'>) {
    return this.execute(this.persistence.manageBudget, 'benefit.budgets.manage', transaction, input, context);
  }
  createGrant(transaction: ReadTransactionContext, input: OperationInputFor<'benefit.grants.create'>, context: ExecutionContext<'benefit.grants.create'>) {
    return this.execute(this.persistence.createGrant, 'benefit.grants.create', transaction, input, context);
  }
  decideGrant(transaction: ReadTransactionContext, input: OperationInputFor<'benefit.grants.decide'>, context: ExecutionContext<'benefit.grants.decide'>) {
    return this.execute(this.persistence.decideGrant, 'benefit.grants.decide', transaction, input, context);
  }
  readGrants(transaction: ReadTransactionContext, input: OperationInputFor<'benefit.grants.read'>, context: ExecutionContext<'benefit.grants.read'>) {
    return this.execute(this.persistence.readGrants, 'benefit.grants.read', transaction, input, context);
  }
  controlGrant(transaction: ReadTransactionContext, input: OperationInputFor<'benefit.grants.control'>, context: ExecutionContext<'benefit.grants.control'>) {
    return this.execute(this.persistence.controlGrant, 'benefit.grants.control', transaction, input, context);
  }
  revokeGrant(transaction: ReadTransactionContext, input: OperationInputFor<'benefit.grants.revoke'>, context: ExecutionContext<'benefit.grants.revoke'>) {
    return this.execute(this.persistence.revokeGrant, 'benefit.grants.revoke', transaction, input, context);
  }
  readLots(transaction: ReadTransactionContext, input: OperationInputFor<'benefit.lots.read'>, context: ExecutionContext<'benefit.lots.read'>) {
    return this.execute(this.persistence.readLots, 'benefit.lots.read', transaction, input, context);
  }

  private async execute<TKey extends OperationId>(
    action: BenefitAction,
    operation: TKey,
    transaction: ReadTransactionContext,
    input: OperationInputFor<TKey>,
    context: ExecutionContext<TKey>
  ): Promise<OperationReply<OperationOutputFor<TKey>>> {
    const result = await action(operationRequest(operation, input, context), this.transactions.database(transaction));
    return { status: result.status, body: result.body as OperationOutputFor<TKey>, ...(result.headers === undefined ? {} : { headers: result.headers }) };
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
