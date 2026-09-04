import { randomUUID } from 'node:crypto';
import { PgRuntimeWriter } from '../../../../adapter/database/PgRuntimeWriter';
import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { SessionRevocationRepository } from '../../application/port/SessionRevocationRepository';

export class PgSessionRevocationRepository implements SessionRevocationRepository {
  constructor(private readonly transactions = new PgTransactionAccess()) {}

  async revokeStale(context: Parameters<SessionRevocationRepository['revokeStale']>[0], input: Parameters<SessionRevocationRepository['revokeStale']>[1]): Promise<readonly string[]> {
    const database = this.transactions.database(context);
    const result = await database.query<{ id: string }>(
      `update identity.session set revoked_at=clock_timestamp(),revoked_reason='access_version_changed'
      where membership_id=$1 and access_version<$2 and revoked_at is null returning id`,
      [input.membership, input.version]
    );
    const sessions = Object.freeze(result.rows.map((row) => row.id));
    if (sessions.length > 0) {
      await new PgRuntimeWriter(database).append({
        id: `event:${randomUUID()}`,
        type: 'identity.session.revoked',
        aggregateType: 'membership',
        aggregate: input.membership,
        scope: input.membership,
        payload: { sessions: [...sessions], reason: input.reason },
        trace: input.trace,
      });
    }
    return sessions;
  }
}
