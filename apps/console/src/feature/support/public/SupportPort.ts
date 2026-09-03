import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import type { Agent, AgentPage } from '../model/Agent';
import type { ConversationPage, MessageDraft, UploadedAttachment } from '../model/Message';
import type { HistoryPage } from '../model/History';
import type { Account, AccountChange, AgentChange, ConfigPage, Rule, RuleChange, Sla, SlaChange } from '../model/SupportConfig';
import type { SupportEvent } from '../model/SupportEvent';
import type { Ticket, TicketPage } from '../model/Ticket';
import type { TicketFilter } from '../model/TicketFilter';

export interface SupportPort {
  queue(context: ConsoleContext, filter: TicketFilter, signal?: AbortSignal): Promise<TicketPage>;
  conversation(context: ConsoleContext, ticket: string, cursor?: string, signal?: AbortSignal): Promise<ConversationPage>;
  history(context: ConsoleContext, ticket: string, cursor?: string, signal?: AbortSignal): Promise<HistoryPage>;
  agents(context: ConsoleContext, cursor?: string, signal?: AbortSignal): Promise<AgentPage>;
  accounts(context: ConsoleContext, cursor?: string, signal?: AbortSignal): Promise<ConfigPage<Account>>;
  rules(context: ConsoleContext, cursor?: string, signal?: AbortSignal): Promise<ConfigPage<Rule>>;
  slas(context: ConsoleContext, cursor?: string, signal?: AbortSignal): Promise<ConfigPage<Sla>>;
  send(context: ConsoleContext, ticket: Ticket, draft: MessageDraft): Promise<void>;
  updateRead(context: ConsoleContext, conversation: string, sequence: number): Promise<void>;
  close(context: ConsoleContext, ticket: Ticket): Promise<void>;
  reopen(context: ConsoleContext, ticket: Ticket): Promise<void>;
  assign(context: ConsoleContext, ticket: Ticket, agent: string, reason: string): Promise<void>;
  upload(context: ConsoleContext, ticket: string, file: File): Promise<UploadedAttachment>;
  manageAgent(context: ConsoleContext, id: string, version: number, change: AgentChange): Promise<void>;
  manageAccount(context: ConsoleContext, id: string, version: number, change: AccountChange): Promise<void>;
  manageRule(context: ConsoleContext, id: string, version: number, change: RuleChange): Promise<void>;
  manageSla(context: ConsoleContext, id: string, version: number, change: SlaChange): Promise<void>;
  listen(context: ConsoleContext, receive: (event: SupportEvent) => void, resync: () => void, signal: AbortSignal): Promise<void>;
  createMessageDraft(ticket: string, message: string, attachmentIds: readonly string[]): MessageDraft;
}

export type { Agent };
