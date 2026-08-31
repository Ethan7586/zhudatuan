import type { OperationDatabase } from '../../../../foundation/application/ModuleOperations';
import type { DirectoryInboxPort } from '../../application/port/DirectoryInboxPort';

export class PgDirectoryInbox implements DirectoryInboxPort {
  async receive(database: OperationDatabase, input: Readonly<{ connection: string; eventid: string; version: number; bodyhash: string; payload: string }>): Promise<'accepted' | 'duplicate' | 'stale'> {
    const result = await database.query<{ outcome: 'accepted' | 'duplicate' | 'stale' }>('select organization.receive_directory_event($1,$2,$3,$4,$5) outcome', [
      input.connection,
      input.eventid,
      input.version,
      input.bodyhash,
      input.payload,
    ]);
    return result.rows[0]?.outcome ?? 'duplicate';
  }
}
