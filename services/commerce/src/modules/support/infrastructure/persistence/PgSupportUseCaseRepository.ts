import { type SqlExecutor } from '../../../../adapter/database/PgTransactionAccess';
import type { OperationId, OperationInputFor } from '@shop/contract';
import type { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { ExecutionContext } from '../../../../foundation/application/HandlerContext';
import type { OperationRequest, OperationResult } from '../../../../foundation/application/OperationHandler';

import type { KmsClient } from '../../../../foundation/infrastructure/KmsClient';
import type { ObjectStore } from '../../../../foundation/infrastructure/ObjectStore';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { MemberAccessPort } from '../../../access/public';
import type { SupportBenefitPort } from '../../../benefit/public';
import type { OrganizationReadPort } from '../../../organization/public';
import type { GetOrderSummary } from '../../../order/public';
import type { AccountRepository, AgentRepository, AssignmentRepository, AttachmentRepository, CaseRepository, MessageRepository, PreparedSupportOperation, RuleRepository, SlaRepository } from '../../application/port/SupportRepositories';
import { PgSupportRepository } from './PgSupportRepository';
import { supportCasePersistence } from './SupportCaseActions';
import { supportConversationPersistence } from './SupportConversationQueries';
import { supportListPersistence } from './SupportListQueries';
import { supportManagementPersistence } from './SupportManagementActions';
import { supportMessagePersistence } from './SupportMessageActions';
import { supportTransitionPersistence } from './SupportTransitionActions';
import type { SupportEntry, SupportLifecycle, SupportPersistence } from './SupportAction';
export class PgSupportUseCaseRepository implements CaseRepository, MessageRepository, AttachmentRepository, AssignmentRepository, AgentRepository, RuleRepository, SlaRepository, AccountRepository {
  private readonly persistence: SupportPersistence;
  constructor(
    private readonly transactions: PgTransactionAccess,
    kms: KmsClient,
    objects: ObjectStore,
    orders: Pick<GetOrderSummary, 'execute'>,
    organizations: OrganizationReadPort,
    members: MemberAccessPort,
    benefits: SupportBenefitPort
  ) {
    const ports = (database: SqlExecutor) => new PgSupportRepository(database, orders, organizations, members, benefits);
    this.persistence = Object.freeze({
      ...supportCasePersistence(kms, ports),
      ...supportMessagePersistence(kms, objects, ports),
      ...supportManagementPersistence(ports),
      ...supportTransitionPersistence(ports),
      ...supportConversationPersistence(kms, ports),
      ...supportListPersistence(ports),
    });
  }
  prepareCase(input: OperationInputFor<'support.cases.create'>, execution: ExecutionContext<'support.cases.create'>) {
    return this.prepare(this.persistence.createCase, 'support.cases.create', input, execution);
  }
  createCase(context: ReadTransactionContext, input: OperationInputFor<'support.cases.create'>, execution: ExecutionContext<'support.cases.create'>, prepared: PreparedSupportOperation) {
    return this.run(this.persistence.createCase, 'support.cases.create', context, input, execution, prepared) as never;
  }
  readCases(context: ReadTransactionContext, input: OperationInputFor<'support.cases.read'>, execution: ExecutionContext<'support.cases.read'>) {
    return this.run(this.persistence.readCases, 'support.cases.read', context, input, execution) as never;
  }
  updateCase(context: ReadTransactionContext, input: OperationInputFor<'support.cases.update'>, execution: ExecutionContext<'support.cases.update'>) {
    return this.run(this.persistence.updateCase, 'support.cases.update', context, input, execution) as never;
  }
  closeCase(context: ReadTransactionContext, input: OperationInputFor<'support.cases.close'>, execution: ExecutionContext<'support.cases.close'>) {
    return this.run(this.persistence.closeCase, 'support.cases.close', context, input, execution) as never;
  }
  reopenCase(context: ReadTransactionContext, input: OperationInputFor<'support.cases.reopen'>, execution: ExecutionContext<'support.cases.reopen'>) {
    return this.run(this.persistence.reopenCase, 'support.cases.reopen', context, input, execution) as never;
  }
  readHistory(context: ReadTransactionContext, input: OperationInputFor<'support.history.read'>, execution: ExecutionContext<'support.history.read'>) {
    return this.run(this.persistence.readHistory, 'support.history.read', context, input, execution) as never;
  }
  prepareMessage(input: OperationInputFor<'support.messages.send'>, execution: ExecutionContext<'support.messages.send'>) {
    return this.prepare(this.persistence.sendMessage, 'support.messages.send', input, execution);
  }
  sendMessage(context: ReadTransactionContext, input: OperationInputFor<'support.messages.send'>, execution: ExecutionContext<'support.messages.send'>, prepared: PreparedSupportOperation) {
    return this.run(this.persistence.sendMessage, 'support.messages.send', context, input, execution, prepared) as never;
  }
  readMessages(context: ReadTransactionContext, input: OperationInputFor<'support.messages.read'>, execution: ExecutionContext<'support.messages.read'>) {
    return this.run(this.persistence.readMessages, 'support.messages.read', context, input, execution) as never;
  }
  finalizeMessages(input: OperationInputFor<'support.messages.read'>, execution: ExecutionContext<'support.messages.read'>, response: never) {
    return this.finalize(this.persistence.readMessages, 'support.messages.read', input, execution, response) as never;
  }
  prepareAttachment(input: OperationInputFor<'support.attachments.create'>, execution: ExecutionContext<'support.attachments.create'>) {
    return this.prepare(this.persistence.createAttachment, 'support.attachments.create', input, execution);
  }
  createAttachment(context: ReadTransactionContext, input: OperationInputFor<'support.attachments.create'>, execution: ExecutionContext<'support.attachments.create'>, prepared: PreparedSupportOperation) {
    return this.run(this.persistence.createAttachment, 'support.attachments.create', context, input, execution, prepared) as never;
  }
  manageAssignment(context: ReadTransactionContext, input: OperationInputFor<'support.assignments.manage'>, execution: ExecutionContext<'support.assignments.manage'>) {
    return this.run(this.persistence.manageAssignment, 'support.assignments.manage', context, input, execution) as never;
  }
  readAgents(context: ReadTransactionContext, input: OperationInputFor<'support.agents.read'>, execution: ExecutionContext<'support.agents.read'>) {
    return this.run(this.persistence.readAgents, 'support.agents.read', context, input, execution) as never;
  }
  manageAgent(context: ReadTransactionContext, input: OperationInputFor<'support.agents.manage'>, execution: ExecutionContext<'support.agents.manage'>) {
    return this.run(this.persistence.manageAgent, 'support.agents.manage', context, input, execution) as never;
  }
  readRules(context: ReadTransactionContext, input: OperationInputFor<'support.rules.read'>, execution: ExecutionContext<'support.rules.read'>) {
    return this.run(this.persistence.readRules, 'support.rules.read', context, input, execution) as never;
  }
  manageRule(context: ReadTransactionContext, input: OperationInputFor<'support.rules.manage'>, execution: ExecutionContext<'support.rules.manage'>) {
    return this.run(this.persistence.manageRule, 'support.rules.manage', context, input, execution) as never;
  }
  readSlas(context: ReadTransactionContext, input: OperationInputFor<'support.slas.read'>, execution: ExecutionContext<'support.slas.read'>) {
    return this.run(this.persistence.readSlas, 'support.slas.read', context, input, execution) as never;
  }
  manageSla(context: ReadTransactionContext, input: OperationInputFor<'support.slas.manage'>, execution: ExecutionContext<'support.slas.manage'>) {
    return this.run(this.persistence.manageSla, 'support.slas.manage', context, input, execution) as never;
  }
  readAccounts(context: ReadTransactionContext, input: OperationInputFor<'support.accounts.read'>, execution: ExecutionContext<'support.accounts.read'>) {
    return this.run(this.persistence.readAccounts, 'support.accounts.read', context, input, execution) as never;
  }
  manageAccount(context: ReadTransactionContext, input: OperationInputFor<'support.accounts.manage'>, execution: ExecutionContext<'support.accounts.manage'>) {
    return this.run(this.persistence.manageAccount, 'support.accounts.manage', context, input, execution) as never;
  }
  private async prepare<TKey extends OperationId>(lifecycle: SupportLifecycle<unknown, unknown>, operation: TKey, input: OperationInputFor<TKey>, execution: ExecutionContext<TKey>): Promise<unknown> {
    return lifecycle.prepare ? lifecycle.prepare(supportRequest(operation, input, execution), undefined) : undefined;
  }
  private run<TKey extends OperationId>(entry: SupportEntry, operation: TKey, context: ReadTransactionContext, input: OperationInputFor<TKey>, execution: ExecutionContext<TKey>, prepared?: unknown): Promise<OperationResult> {
    const request = supportRequest(operation, input, execution);
    const database = this.transactions.database(context);
    return typeof entry === 'function' ? entry(request, database) : entry.execute(request, database, prepared);
  }
  private async finalize<TKey extends OperationId>(lifecycle: SupportLifecycle<unknown, unknown>, operation: TKey, input: OperationInputFor<TKey>, execution: ExecutionContext<TKey>, result: OperationResult): Promise<OperationResult> {
    return lifecycle.finalize ? lifecycle.finalize(supportRequest(operation, input, execution), result, undefined) : result;
  }
}
function supportRequest<TKey extends OperationId>(type: TKey, input: OperationInputFor<TKey>, execution: ExecutionContext<TKey>): OperationRequest {
  const wire = input as Readonly<{
    path?: Readonly<Record<string, string>>;
    query?: Readonly<Record<string, string | readonly string[]>>;
    body?: unknown;
  }>;
  return {
    type,
    input: {
      path: wire.path ?? {},
      query: wire.query ?? {},
      headers: execution.headers,
      body: wire.body,
      rawBody: execution.rawBody,
      deadline: execution.deadline,
      signal: execution.signal,
      ...(execution.idempotencyKey === undefined ? {} : { idempotency: execution.idempotencyKey }),
      ...(execution.expectedVersion === undefined ? {} : { expectedVersion: execution.expectedVersion }),
    },
    security: execution.security,
  };
}
