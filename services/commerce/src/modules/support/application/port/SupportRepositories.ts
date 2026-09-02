import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { ExecutionContext } from '../../../../foundation/application/HandlerContext';
import type { OperationReply } from '../../../../foundation/application/OperationHandler';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';

export type PreparedSupportOperation = unknown;

export interface CaseRepository {
  prepareCase(input: OperationInputFor<'support.cases.create'>, execution: ExecutionContext<'support.cases.create'>): Promise<PreparedSupportOperation>;
  createCase(
    context: WriteTransactionContext,
    input: OperationInputFor<'support.cases.create'>,
    execution: ExecutionContext<'support.cases.create'>,
    prepared: PreparedSupportOperation
  ): Promise<OperationReply<OperationOutputFor<'support.cases.create'>>>;
  readCases(context: ReadTransactionContext, input: OperationInputFor<'support.cases.read'>, execution: ExecutionContext<'support.cases.read'>): Promise<OperationReply<OperationOutputFor<'support.cases.read'>>>;
  updateCase(context: WriteTransactionContext, input: OperationInputFor<'support.cases.update'>, execution: ExecutionContext<'support.cases.update'>): Promise<OperationReply<OperationOutputFor<'support.cases.update'>>>;
  closeCase(context: WriteTransactionContext, input: OperationInputFor<'support.cases.close'>, execution: ExecutionContext<'support.cases.close'>): Promise<OperationReply<OperationOutputFor<'support.cases.close'>>>;
  reopenCase(context: WriteTransactionContext, input: OperationInputFor<'support.cases.reopen'>, execution: ExecutionContext<'support.cases.reopen'>): Promise<OperationReply<OperationOutputFor<'support.cases.reopen'>>>;
  readHistory(context: ReadTransactionContext, input: OperationInputFor<'support.history.read'>, execution: ExecutionContext<'support.history.read'>): Promise<OperationReply<OperationOutputFor<'support.history.read'>>>;
}

export interface MessageSender {
  loadMessage(context: ReadTransactionContext, input: OperationInputFor<'support.messages.send'>, execution: ExecutionContext<'support.messages.send'>): Promise<PreparedSupportOperation>;
  prepareMessage(input: OperationInputFor<'support.messages.send'>, execution: ExecutionContext<'support.messages.send'>, loaded: PreparedSupportOperation): Promise<PreparedSupportOperation>;
  sendMessage(
    context: WriteTransactionContext,
    input: OperationInputFor<'support.messages.send'>,
    execution: ExecutionContext<'support.messages.send'>,
    prepared: PreparedSupportOperation
  ): Promise<OperationReply<OperationOutputFor<'support.messages.send'>>>;
}

export interface MessageReader {
  readMessages(context: ReadTransactionContext, input: OperationInputFor<'support.messages.read'>, execution: ExecutionContext<'support.messages.read'>): Promise<OperationReply<OperationOutputFor<'support.messages.read'>>>;
  finalizeMessages(
    input: OperationInputFor<'support.messages.read'>,
    execution: ExecutionContext<'support.messages.read'>,
    response: OperationReply<OperationOutputFor<'support.messages.read'>>
  ): Promise<OperationReply<OperationOutputFor<'support.messages.read'>>>;
}

export type MessageRepository = MessageSender & MessageReader;

export interface AttachmentRepository {
  prepareAttachment(input: OperationInputFor<'support.attachments.create'>, execution: ExecutionContext<'support.attachments.create'>): Promise<PreparedSupportOperation>;
  createAttachment(
    context: WriteTransactionContext,
    input: OperationInputFor<'support.attachments.create'>,
    execution: ExecutionContext<'support.attachments.create'>,
    prepared: PreparedSupportOperation
  ): Promise<OperationReply<OperationOutputFor<'support.attachments.create'>>>;
}

export interface AssignmentRepository {
  manageAssignment(
    context: WriteTransactionContext,
    input: OperationInputFor<'support.assignments.manage'>,
    execution: ExecutionContext<'support.assignments.manage'>
  ): Promise<OperationReply<OperationOutputFor<'support.assignments.manage'>>>;
}

export interface ReadStateRepository {
  manageReadState(
    context: WriteTransactionContext,
    input: OperationInputFor<'support.readstates.manage'>,
    execution: ExecutionContext<'support.readstates.manage'>
  ): Promise<OperationReply<OperationOutputFor<'support.readstates.manage'>>>;
}

export interface AgentRepository {
  readAgents(context: ReadTransactionContext, input: OperationInputFor<'support.agents.read'>, execution: ExecutionContext<'support.agents.read'>): Promise<OperationReply<OperationOutputFor<'support.agents.read'>>>;
  manageAgent(context: WriteTransactionContext, input: OperationInputFor<'support.agents.manage'>, execution: ExecutionContext<'support.agents.manage'>): Promise<OperationReply<OperationOutputFor<'support.agents.manage'>>>;
}

export interface RuleRepository {
  readRules(context: ReadTransactionContext, input: OperationInputFor<'support.rules.read'>, execution: ExecutionContext<'support.rules.read'>): Promise<OperationReply<OperationOutputFor<'support.rules.read'>>>;
  manageRule(context: WriteTransactionContext, input: OperationInputFor<'support.rules.manage'>, execution: ExecutionContext<'support.rules.manage'>): Promise<OperationReply<OperationOutputFor<'support.rules.manage'>>>;
}

export interface SlaRepository {
  readSlas(context: ReadTransactionContext, input: OperationInputFor<'support.slas.read'>, execution: ExecutionContext<'support.slas.read'>): Promise<OperationReply<OperationOutputFor<'support.slas.read'>>>;
  manageSla(context: WriteTransactionContext, input: OperationInputFor<'support.slas.manage'>, execution: ExecutionContext<'support.slas.manage'>): Promise<OperationReply<OperationOutputFor<'support.slas.manage'>>>;
}

export interface AccountRepository {
  loadAccount(context: ReadTransactionContext, input: OperationInputFor<'support.accounts.manage'>, execution: ExecutionContext<'support.accounts.manage'>): Promise<PreparedSupportOperation>;
  prepareAccount(input: OperationInputFor<'support.accounts.manage'>, execution: ExecutionContext<'support.accounts.manage'>, loaded: PreparedSupportOperation): Promise<PreparedSupportOperation>;
  readAccounts(context: ReadTransactionContext, input: OperationInputFor<'support.accounts.read'>, execution: ExecutionContext<'support.accounts.read'>): Promise<OperationReply<OperationOutputFor<'support.accounts.read'>>>;
  manageAccount(context: WriteTransactionContext, input: OperationInputFor<'support.accounts.manage'>, execution: ExecutionContext<'support.accounts.manage'>, prepared: PreparedSupportOperation): Promise<OperationReply<OperationOutputFor<'support.accounts.manage'>>>;
}
