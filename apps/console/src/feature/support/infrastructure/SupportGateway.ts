import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import { createIdempotencyKey } from '@shop/sdk/context';
import { createFetchSupport } from '@shop/sdk/support';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { consoleCommand, consoleRequest, consoleStream } from '../../../shared/api/Client';
import { appConfig } from '../../../shared/config/AppConfig';
import type { TicketFilter } from '../model/TicketFilter';

const support = createFetchSupport(appConfig.apiBaseUrl);

export class SupportGateway {
  queue(context: ConsoleContext, filter: TicketFilter, signal?: AbortSignal) {
    return support.casesRead({ query: filter }, consoleRequest(context.scope, signal, context.session.accessVersion));
  }
  conversation(context: ConsoleContext, ticket: string, cursor?: string, signal?: AbortSignal) {
    return support.messagesRead({ path: { caseid: ticket }, query: { limit: 100, ...(cursor ? { cursor } : {}) } }, consoleRequest(context.scope, signal, context.session.accessVersion));
  }
  history(context: ConsoleContext, ticket: string, cursor?: string, signal?: AbortSignal) {
    return support.historyRead({ path: { caseid: ticket }, query: { limit: 100, ...(cursor ? { cursor } : {}) } }, consoleRequest(context.scope, signal, context.session.accessVersion));
  }
  events(context: ConsoleContext, conversationId?: string, signal?: AbortSignal, lastEventId?: string) {
    return support.eventsRead({ query: { ...(conversationId ? { conversationId } : {}) } }, consoleStream(context.scope, context.session.accessVersion, signal, lastEventId));
  }
  send(context: ConsoleContext, input: Readonly<{ ticket: string; version: number; message: string; attachmentIds: readonly string[]; clientMessageId: string; idempotencyKey: string }>) {
    return support.messagesSend(
      { path: { caseid: input.ticket }, body: { message: input.message, clientMessageId: input.clientMessageId, ...(input.attachmentIds.length ? { attachmentIds: input.attachmentIds } : {}) } },
      this.command(context, input.version, input.idempotencyKey)
    );
  }
  read(context: ConsoleContext, conversation: string, sequence: number, idempotencyKey = createIdempotencyKey()) {
    return support.readstatesManage({ path: { conversationid: conversation }, body: { lastSequence: sequence } }, this.command(context, undefined, idempotencyKey));
  }
  close(context: ConsoleContext, ticket: string, version: number) {
    return support.casesClose({ path: { caseid: ticket }, body: {} }, this.command(context, version));
  }
  reopen(context: ConsoleContext, ticket: string, version: number) {
    return support.casesReopen({ path: { caseid: ticket }, body: {} }, this.command(context, version));
  }
  assign(context: ConsoleContext, ticket: string, version: number, agent: string, reason: string) {
    return support.assignmentsManage({ path: { assignmentid: `assignment:${crypto.randomUUID()}` }, body: { case: ticket, agent, reason } }, this.command(context, version));
  }
  attachment(context: ConsoleContext, ticket: string, body: NonNullable<OperationInputFor<'support.attachments.create'>['body']>) {
    return support.attachmentsCreate({ path: { caseid: ticket }, body }, this.command(context));
  }
  agents(context: ConsoleContext, cursor?: string, signal?: AbortSignal) { return support.agentsRead({ query: { limit: 100, ...(cursor ? { cursor } : {}) } }, consoleRequest(context.scope, signal, context.session.accessVersion)); }
  accounts(context: ConsoleContext, cursor?: string, signal?: AbortSignal) { return support.accountsRead({ query: { limit: 100, ...(cursor ? { cursor } : {}) } }, consoleRequest(context.scope, signal, context.session.accessVersion)); }
  rules(context: ConsoleContext, cursor?: string, signal?: AbortSignal) { return support.rulesRead({ query: { limit: 100, ...(cursor ? { cursor } : {}) } }, consoleRequest(context.scope, signal, context.session.accessVersion)); }
  slas(context: ConsoleContext, cursor?: string, signal?: AbortSignal) { return support.slasRead({ query: { limit: 100, ...(cursor ? { cursor } : {}) } }, consoleRequest(context.scope, signal, context.session.accessVersion)); }
  manageAgent(context: ConsoleContext, id: string, version: number, body: NonNullable<OperationInputFor<'support.agents.manage'>['body']>) { return support.agentsManage({ path: { agentid: id }, body }, this.command(context, version)); }
  manageAccount(context: ConsoleContext, id: string, version: number, body: NonNullable<OperationInputFor<'support.accounts.manage'>['body']>) { return support.accountsManage({ path: { accountid: id }, body }, this.command(context, version)); }
  manageRule(context: ConsoleContext, id: string, version: number, body: NonNullable<OperationInputFor<'support.rules.manage'>['body']>) { return support.rulesManage({ path: { ruleid: id }, body }, this.command(context, version)); }
  manageSla(context: ConsoleContext, id: string, version: number, body: NonNullable<OperationInputFor<'support.slas.manage'>['body']>) { return support.slasManage({ path: { slaid: id }, body }, this.command(context, version)); }
  private command(context: ConsoleContext, expectedVersion?: number, idempotencyKey = createIdempotencyKey()) {
    return consoleCommand(context.scope, { accessVersion: context.session.accessVersion, ...(expectedVersion === undefined ? {} : { expectedVersion }), idempotencyKey, ...(context.session.csrf === undefined ? {} : { csrfToken: context.session.csrf }) });
  }
}

export type SupportEvent = OperationOutputFor<'support.events.read'>;
