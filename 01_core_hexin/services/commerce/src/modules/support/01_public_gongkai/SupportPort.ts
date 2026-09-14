import type { QueryResult, QueryResultRow } from 'pg';
import type { OperationDatabase } from '../../../foundation/application/ModuleOperations';
import type { AssignmentRule } from '../02_domain_yewu/model/AssignmentRule';
import type { Agent } from '../02_domain_yewu/policy/AssignmentPolicy';
import type { TicketPriority } from '../02_domain_yewu/model/Ticket';

export interface EncryptedMessage { readonly id: string; readonly ciphertext: string; readonly fingerprint: string; readonly keyVersion: string }
export interface SlaPolicy { readonly response: number; readonly resolution: number }

export interface SupportPort {
  member(membership: string): Promise<string>;
  assertOrder(order: string, scope: string, member: string, memberOnly: boolean): Promise<void>;
  benefit(type: string, id: string, scope: string, member: string): Promise<Readonly<Record<string, unknown>>>;
  agents(scope: string): Promise<readonly Agent[]>;
  rules(scope: string): Promise<readonly AssignmentRule[]>;
  sla(scope: string, priority: TicketPriority): Promise<SlaPolicy | null>;
  message(ticket: string, conversation: string, scope: string, author: 'member' | 'agent', actor: string,
    message: EncryptedMessage): Promise<QueryResult<QueryResultRow>>;
  history(ticket: string, scope: string, kind: string, actor: string, evidence: Readonly<Record<string, unknown>>): Promise<void>;
  enqueue(kind: 'supportsla' | 'supportscan', scope: string, payload: Readonly<Record<string, unknown>>, availableAt?: string,
    stableId?: string): Promise<void>;
}

export type SupportPortFactory = (database: OperationDatabase) => SupportPort;
