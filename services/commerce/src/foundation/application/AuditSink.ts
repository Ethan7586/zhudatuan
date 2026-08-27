import { token } from '../../bootstrap/Container';
import type { QueryResult, QueryResultRow } from 'pg';

export interface AuditDatabase { query<R extends QueryResultRow = QueryResultRow>(text: string, values?: readonly unknown[]): Promise<QueryResult<R>> }

export interface AuditWriteInput {
  readonly scope: string; readonly actor: string; readonly actorType: string; readonly action: string; readonly resourceType: string;
  readonly resource: string | null; readonly before: unknown; readonly after: unknown; readonly evidence: unknown; readonly trace: string;
}

export interface AuditAccessInput {
  readonly scope: string; readonly actor: string; readonly actorType: string; readonly resourceType: string; readonly resource: string;
  readonly fields: unknown; readonly purpose: string; readonly trace: string;
}

export interface AuditSink {
  record(database: AuditDatabase, input: AuditWriteInput): Promise<void>;
  access(database: AuditDatabase, input: AuditAccessInput): Promise<void>;
}

export const AUDIT_SINK = token<AuditSink>('audit.sink');
