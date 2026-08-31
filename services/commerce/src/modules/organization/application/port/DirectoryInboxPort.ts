import type { OperationDatabase } from '../../../../foundation/application/ModuleOperations';
export interface DirectoryInboxPort {
  receive(database: OperationDatabase, input: Readonly<{ connection: string; eventid: string; version: number; bodyhash: string; payload: string }>): Promise<'accepted' | 'duplicate' | 'stale'>;
}
