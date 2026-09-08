import { createHash } from 'node:crypto';
import { PgRuntimeWriter } from '../../../../platform/database/PgRuntimeWriter';
import { PgTransactionAccess } from '../../../../platform/database/PgTransactionAccess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import type { DirectoryAnomaly, DirectoryJobRepository } from '../../application/port/DirectoryJobRepository';

export class PgDirectoryJobRepository implements DirectoryJobRepository {
  private readonly transactions = new PgTransactionAccess();

  async anomalies(context: ReadTransactionContext): Promise<readonly DirectoryAnomaly[]> {
    const result = await this.transactions.database(context).query<{ connection: string; code: string; count: string }>(
      `select connection.id::text connection,'missingtwice' code,count(*)::text count
      from organization.directoryconnection connection join organization.directorysubject subject on subject.connection_id=connection.id
      where connection.status='enabled' and subject.missing_count>=2 and subject.status='active' group by connection.id
      union all select connection.id::text,'conflict',count(*)::text from organization.directoryconnection connection
      join organization.directorysubject subject on subject.connection_id=connection.id where connection.status='enabled' and subject.status='conflict' group by connection.id`
    );
    return Object.freeze(result.rows.map(({ connection, code, count }) => Object.freeze({ connection, code, count: Number(count) })));
  }

  alert(context: WriteTransactionContext, anomaly: DirectoryAnomaly, date: string): Promise<void> {
    const source = `directory:${digest(`${anomaly.connection}:${anomaly.code}:${date}`)}`;
    return new PgRuntimeWriter(this.transactions.database(context)).deadletter({
      id: `alert:${source}`,
      kind: 'provider',
      source,
      owner: 'organization',
      payload: { connectionhash: digest(anomaly.connection), count: anomaly.count },
      error: `DIRECTORY_${anomaly.code.toUpperCase()}`,
    });
  }
}

function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
