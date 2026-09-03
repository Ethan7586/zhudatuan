import { createIdempotencyKey, EventStreamResyncError, uploadObject } from '@shop/sdk';
import type { OperationInputFor } from '@shop/contract';
import { createFetchSupport } from '@shop/sdk/support';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { consoleCommand, consoleRequest, consoleStream } from '../../../shared/api/Client';
import type { MessageDraft, UploadedAttachment } from '../model/Message';
import type { AccountChange, AgentChange, RuleChange, SlaChange } from '../model/SupportConfig';
import type { SupportEvent } from '../model/SupportEvent';
import type { Ticket } from '../model/Ticket';
import type { TicketFilter } from '../model/TicketFilter';
import type { SupportPort } from '../public';
import { SupportMapper } from './SupportMapper';

export interface SupportGatewayConfig { readonly apiBaseUrl: string }

export class SupportGateway implements SupportPort {
  private readonly client;

  constructor(config: SupportGatewayConfig, private readonly mapper = new SupportMapper()) {
    this.client = createFetchSupport(config.apiBaseUrl);
  }

  async queue(context: ConsoleContext, filter: TicketFilter, signal?: AbortSignal) {
    const query = { ...filter, ...(filter.states ? { states: [...filter.states] } : {}), ...(filter.priorities ? { priorities: [...filter.priorities] } : {}) };
    return this.mapper.ticketPage(await this.client.casesRead({ query }, consoleRequest(context.scope, signal, context.session.accessVersion)));
  }

  async conversation(context: ConsoleContext, ticket: string, cursor?: string, signal?: AbortSignal) {
    const value = await this.client.messagesRead({ path: { caseid: ticket }, query: { limit: 100, ...(cursor ? { cursor } : {}) } }, consoleRequest(context.scope, signal, context.session.accessVersion));
    return this.mapper.conversation(value);
  }

  async history(context: ConsoleContext, ticket: string, cursor?: string, signal?: AbortSignal) {
    const value = await this.client.historyRead({ path: { caseid: ticket }, query: { limit: 100, ...(cursor ? { cursor } : {}) } }, consoleRequest(context.scope, signal, context.session.accessVersion));
    return this.mapper.history(value);
  }

  async agents(context: ConsoleContext, cursor?: string, signal?: AbortSignal) {
    return this.mapper.agents(await this.client.agentsRead({ query: { limit: 100, ...(cursor ? { cursor } : {}) } }, consoleRequest(context.scope, signal, context.session.accessVersion)));
  }

  async accounts(context: ConsoleContext, cursor?: string, signal?: AbortSignal) {
    return this.mapper.accounts(await this.client.accountsRead({ query: { limit: 100, ...(cursor ? { cursor } : {}) } }, consoleRequest(context.scope, signal, context.session.accessVersion)));
  }

  async rules(context: ConsoleContext, cursor?: string, signal?: AbortSignal) {
    return this.mapper.rules(await this.client.rulesRead({ query: { limit: 100, ...(cursor ? { cursor } : {}) } }, consoleRequest(context.scope, signal, context.session.accessVersion)));
  }

  async slas(context: ConsoleContext, cursor?: string, signal?: AbortSignal) {
    return this.mapper.slas(await this.client.slasRead({ query: { limit: 100, ...(cursor ? { cursor } : {}) } }, consoleRequest(context.scope, signal, context.session.accessVersion)));
  }

  async send(context: ConsoleContext, ticket: Ticket, draft: MessageDraft): Promise<void> {
    await this.client.messagesSend(
      { path: { caseid: ticket.id }, body: { message: draft.message, clientMessageId: draft.clientMessageId, ...(draft.attachmentIds.length ? { attachmentIds: [...draft.attachmentIds] } : {}) } },
      this.command(context, ticket.version, draft.idempotencyKey)
    );
  }

  async updateRead(context: ConsoleContext, conversation: string, sequence: number): Promise<void> {
    await this.client.readstatesManage({ path: { conversationid: conversation }, body: { lastSequence: sequence } }, this.command(context));
  }

  async close(context: ConsoleContext, ticket: Ticket): Promise<void> {
    await this.client.casesClose({ path: { caseid: ticket.id }, body: {} }, this.command(context, ticket.version));
  }

  async reopen(context: ConsoleContext, ticket: Ticket): Promise<void> {
    await this.client.casesReopen({ path: { caseid: ticket.id }, body: {} }, this.command(context, ticket.version));
  }

  async assign(context: ConsoleContext, ticket: Ticket, agent: string, reason: string): Promise<void> {
    await this.client.assignmentsManage({ path: { assignmentid: `assignment:${crypto.randomUUID()}` }, body: { case: ticket.id, agent, reason } }, this.command(context, ticket.version));
  }

  async upload(context: ConsoleContext, ticket: string, file: File): Promise<UploadedAttachment> {
    const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
    const sha256 = [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
    const intent = await this.client.attachmentsCreate(
      { path: { caseid: ticket }, body: { name: file.name, contentType: contentType(file.type), sizeBytes: file.size, sha256 } },
      this.command(context)
    );
    await uploadObject({ url: intent.upload.url, headers: intent.upload.headers, body: file }).catch(() => {
      throw new Error('附件直传失败，请重新选择文件。');
    });
    return Object.freeze({ id: intent.id, name: file.name, state: 'pending' as const });
  }

  async manageAgent(context: ConsoleContext, id: string, version: number, change: AgentChange): Promise<void> {
    await this.client.agentsManage({ path: { agentid: id }, body: { ...change, skills: [...change.skills] } }, this.command(context, version));
  }

  async manageAccount(context: ConsoleContext, id: string, version: number, change: AccountChange): Promise<void> {
    const body = { provider: change.provider, displayName: change.displayName, state: change.state, ...(change.secretRef !== undefined ? { secretRef: change.secretRef } : {}) } as NonNullable<OperationInputFor<'support.accounts.manage'>['body']>;
    await this.client.accountsManage({ path: { accountid: id }, body }, this.command(context, version));
  }

  async manageRule(context: ConsoleContext, id: string, version: number, change: RuleChange): Promise<void> {
    await this.client.rulesManage({ path: { ruleid: id }, body: { ...change, priorities: [...change.priorities] } }, this.command(context, version));
  }

  async manageSla(context: ConsoleContext, id: string, version: number, change: SlaChange): Promise<void> {
    const body = { priority: change.priority, responseSeconds: change.responseSeconds, resolutionSeconds: change.resolutionSeconds } as NonNullable<OperationInputFor<'support.slas.manage'>['body']>;
    await this.client.slasManage({ path: { slaid: id }, body }, this.command(context, version));
  }

  async listen(context: ConsoleContext, receive: (event: SupportEvent) => void, resync: () => void, signal: AbortSignal): Promise<void> {
    let cursor: string | undefined;
    while (!signal.aborted) {
      const stream = this.client.eventsRead({}, consoleStream(context.scope, context.session.accessVersion, signal, cursor));
      try {
        for await (const value of stream) {
          const event = this.mapper.event(value);
          cursor = event.id;
          receive(event);
        }
      } catch (cause) {
        if (signal.aborted) return;
        if (cause instanceof EventStreamResyncError) {
          cursor = undefined;
          resync();
        } else {
          throw cause;
        }
      } finally {
        stream.close();
      }
      if (!signal.aborted) await retryDelay(signal);
    }
  }

  createMessageDraft(ticketId: string, message: string, attachmentIds: readonly string[]): MessageDraft {
    return Object.freeze({ ticketId, message, attachmentIds: Object.freeze([...attachmentIds]), clientMessageId: crypto.randomUUID(), idempotencyKey: createIdempotencyKey() });
  }

  private command(context: ConsoleContext, expectedVersion?: number, idempotencyKey = createIdempotencyKey()) {
    return consoleCommand(context.scope, { accessVersion: context.session.accessVersion, ...(expectedVersion === undefined ? {} : { expectedVersion }), idempotencyKey, ...(context.session.csrf === undefined ? {} : { csrfToken: context.session.csrf }) });
  }
}

function contentType(value: string): 'image/jpeg' | 'image/png' | 'application/pdf' | 'text/plain' {
  if (value === 'image/jpeg' || value === 'image/png' || value === 'application/pdf' || value === 'text/plain') return value;
  throw new Error('仅支持 JPG、PNG、PDF 或 TXT 文件。');
}

function retryDelay(signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = window.setTimeout(resolve, 1_000);
    signal.addEventListener('abort', () => {
      window.clearTimeout(timer);
      resolve();
    }, { once: true });
  });
}
