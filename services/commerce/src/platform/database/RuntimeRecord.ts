import type { QueryResult, QueryResultRow } from 'pg';

export interface RuntimeSql {
  query<R extends QueryResultRow = QueryResultRow>(text: string, values?: readonly unknown[]): Promise<QueryResult<R>>;
}

export interface RuntimeJobInput {
  readonly id: string;
  readonly kind: string;
  readonly owner: string;
  readonly scope: string | null;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly priority: number;
  readonly availableAt?: string;
  readonly authorization?: Readonly<Record<string, unknown>>;
}

export interface RuntimeEventInput {
  readonly id: string;
  readonly type: string;
  readonly aggregateType: string;
  readonly aggregate: string;
  readonly scope: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly trace: string;
  readonly version?: number;
  readonly aggregateVersion?: number;
  readonly actor?: string;
  readonly correlation?: string;
  readonly causation?: string;
  readonly payloadVersion?: number;
}

export interface RuntimeInboxEvent {
  readonly id: string;
  readonly type: string;
  readonly version: number;
  readonly aggregate: string;
  readonly scope: string;
  readonly payload: Record<string, unknown>;
  readonly occurredAt: string;
}
