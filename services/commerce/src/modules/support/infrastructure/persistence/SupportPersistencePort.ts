import { type SqlExecutor } from '../../../../adapter/database/PgTransactionAccess';
import type { QueryResult, QueryResultRow } from 'pg';

import type { AssignmentRule } from '../../domain/model/AssignmentRule';
import type { Agent } from '../../domain/policy/AssignmentPolicy';
import type { TicketPriority } from '../../domain/model/Ticket';

export interface EncryptedMessage {
  readonly id: string;
  readonly ciphertext: string;
  readonly fingerprint: string;
  readonly keyVersion: string;
}
export interface SlaPolicy {
  readonly response: number;
  readonly resolution: number;
}

export interface SupportPersistencePort {
  member(membership: string): Promise<string>;
  descendants(scope: string): Promise<readonly string[]>;
  assertOrder(order: string, scope: string, member: string, memberOnly: boolean): Promise<void>;
  benefit(type: string, id: string, scope: string, member: string): Promise<Readonly<Record<string, unknown>>>;
  agents(scope: string): Promise<readonly Agent[]>;
  rules(scope: string): Promise<readonly AssignmentRule[]>;
  sla(scope: string, priority: TicketPriority): Promise<SlaPolicy>;
  message(ticket: string, conversation: string, scope: string, author: 'member' | 'agent', actor: string, message: EncryptedMessage): Promise<QueryResult<QueryResultRow>>;
  history(ticket: string, scope: string, kind: string, actor: string, evidence: Readonly<Record<string, unknown>>): Promise<void>;
  enqueue(kind: 'supportsla' | 'supportscan', scope: string, payload: Readonly<Record<string, unknown>>, availableAt?: Date | string, stableId?: string): Promise<void>;
}

export type SupportPersistenceFactory = (database: SqlExecutor) => SupportPersistencePort;
