import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { ReadState } from '../../domain/model/ReadState';
import type { Ticket, TicketPriority, TicketState } from '../../domain/model/Ticket';
import type { Agent } from '../../domain/policy/AssignmentPolicy';

export interface SupportContextView {
  readonly member: Readonly<{ id: string; displayName: string; employeeNo: string | null; mobileMasked: string | null }>;
  readonly organization: Readonly<{ id: string }>;
  readonly orders: readonly Readonly<{ id: string; number: string; state: string; totalMinor: number }>[];
  readonly benefits: readonly Readonly<{ id: string; state: string; kind: string; currency: string; remainingMinor: number; expiresAt: string | null }>[];
}

export interface SupportContextPort {
  member(context: ReadTransactionContext, membership: string): Promise<string>;
  descendants(context: ReadTransactionContext, scope: string): Promise<readonly string[]>;
  assertOrder(context: ReadTransactionContext, order: string, scope: string, member: string, memberOnly: boolean): Promise<void>;
  benefit(context: ReadTransactionContext, type: string, id: string, scope: string, member: string): Promise<Readonly<Record<string, unknown>>>;
  view(context: ReadTransactionContext, scope: string, member: string, memberOnly: boolean): Promise<SupportContextView>;
}

export interface AssignmentTicket {
  readonly id: string;
  readonly conversation: string;
  readonly scope: string;
  readonly skill: string;
  readonly priority: TicketPriority;
  readonly state: TicketState;
  readonly version: number;
  readonly member: string | null;
}

export interface AssignmentRecord {
  readonly id: string;
  readonly ticket_id: string;
  readonly agent_id: string;
  readonly reason: string;
  readonly assigned_at: string;
  readonly released_at: string | null;
  readonly scope_id: string;
}

export interface AssignmentStore {
  lockTicket(context: WriteTransactionContext, ticket: string, scopes: readonly string[]): Promise<AssignmentTicket>;
  assign(
    context: WriteTransactionContext,
    input: Readonly<{ assignment: string; ticket: AssignmentTicket; agent: string; reason: string; expectedVersion: number }>
  ): Promise<AssignmentRecord>;
}

export interface SupportMessageTarget {
  readonly ticket: Ticket;
  readonly conversation: string;
  readonly conversationVersion: number;
  readonly member: string | null;
  readonly assignedAgent: string | null;
}

export interface TicketMessageStore {
  readMessageTarget(context: ReadTransactionContext, id: string, scopes: readonly string[], member: string, storefront: boolean): Promise<SupportMessageTarget>;
  lockMessageTarget(context: WriteTransactionContext, id: string, scopes: readonly string[], member: string, storefront: boolean): Promise<SupportMessageTarget>;
  advanceMessage(context: WriteTransactionContext, ticket: Ticket, expectedVersion: number, author: 'member' | 'agent'): Promise<Readonly<{ id: string; state: TicketState; version: number }>>;
}

export interface EncryptedSupportMessage {
  readonly id: string;
  readonly clientMessageId: string;
  readonly ciphertext: string;
  readonly fingerprint: string;
  readonly keyVersion: string;
  readonly body: string;
}

export interface StoredSupportMessage {
  readonly id: string;
  readonly clientMessageId: string;
  readonly conversationId: string;
  readonly authorType: 'member' | 'agent';
  readonly authorId: string;
  readonly bodyHash: string;
  readonly sequence: number;
  readonly version: number;
  readonly createdAt: string;
}

export interface MessageStore {
  existing(context: WriteTransactionContext, conversation: string, author: string, clientMessageId: string): Promise<StoredSupportMessage | null>;
  append(
    context: WriteTransactionContext,
    input: Readonly<{
      scope: string;
      conversation: string;
      authorType: 'member' | 'agent';
      authorId: string;
      sequence: number;
      message: EncryptedSupportMessage;
      attachments: readonly string[];
    }>
  ): Promise<StoredSupportMessage>;
}

export interface ConversationStore {
  advance(context: WriteTransactionContext, conversation: string, expectedVersion: number): Promise<Readonly<{ sequence: number; version: number }>>;
}

export interface EvidenceStore {
  assertReady(context: WriteTransactionContext, conversation: string, scope: string, ids: readonly string[]): Promise<void>;
}

export interface AgentStore {
  assertSender(context: ReadTransactionContext, membership: string, scope: string): Promise<string>;
  findByMembership(context: ReadTransactionContext, membership: string, scopes: readonly string[]): Promise<string | null>;
  candidates(context: ReadTransactionContext, scope: string): Promise<readonly Agent[]>;
}

export interface ReadStateStore {
  advance(
    context: WriteTransactionContext,
    input: Readonly<{ conversation: string; membership: string; member: string; scopes: readonly string[]; storefront: boolean; lastSequence: number }>
  ): Promise<Readonly<{ state: ReadState; ticket: string; scope: string }>>;
}

export interface SupportEventStore {
  history(context: WriteTransactionContext, ticket: string, scope: string, kind: string, actor: string, evidence: Readonly<Record<string, unknown>>): Promise<void>;
  append(
    context: WriteTransactionContext,
    input: Readonly<{
      type: string;
      aggregateType: 'ticket' | 'conversation' | 'evidence';
      aggregate: string;
      scope: string;
      trace: string;
      payload: Readonly<Record<string, unknown>>;
    }>
  ): Promise<void>;
  enqueue(
    context: WriteTransactionContext,
    kind: 'supportsla' | 'supportscan' | 'supportreassign' | 'supportrelay',
    scope: string,
    payload: Readonly<Record<string, unknown>>,
    availableAt?: Date | string,
    stableId?: string
  ): Promise<void>;
}
