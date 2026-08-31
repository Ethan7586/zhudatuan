import type { QueryResult, QueryResultRow } from 'pg';

export interface SessionSecurityDatabase {
  query<R extends QueryResultRow = QueryResultRow>(text: string, values?: readonly unknown[]): Promise<QueryResult<R>>;
}

export interface SessionSecurity {
  invalidate(database: SessionSecurityDatabase, principal: string, reason: 'risk_event'): Promise<void>;
}
