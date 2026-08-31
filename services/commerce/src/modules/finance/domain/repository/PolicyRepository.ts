import type { QueryResult, QueryResultRow } from 'pg';

export interface PolicyRepository {
  read(scopeIds: readonly string[], status: string | null, cursor: string | null, limit: number): Promise<QueryResult<QueryResultRow>>;
  affected(scopeIds: readonly string[], from: string, to: string): Promise<number>;
}
