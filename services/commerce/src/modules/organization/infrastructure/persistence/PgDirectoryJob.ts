import { randomUUID } from 'node:crypto';
import type { OperationDatabase } from '../../../../foundation/application/ModuleOperations';
import type { DirectoryJobPort } from '../../application/port/DirectoryJobPort';
export class PgDirectoryJob implements DirectoryJobPort {
  async enqueue(database: OperationDatabase, connection: string, run: string, kind: 'directorysync' | 'directoryreconcile'): Promise<void> {
    await database.query(
      `insert into runtime.job(id,kind,owner,scope_id,payload,state,priority,available_at,created_at,updated_at)
      values($1,$2,'organization',$3,jsonb_build_object('resource',$3,'connection',$3,'run',$4),'queued',20,clock_timestamp(),clock_timestamp(),clock_timestamp())
      on conflict(id) do nothing`,
      [`job:${randomUUID()}`, kind, connection, run]
    );
  }
}
