import type { OperationDatabase } from '../../../../foundation/application/ModuleOperations';
export interface DirectoryJobPort {
  enqueue(database: OperationDatabase, connection: string, run: string, kind: 'directorysync' | 'directoryreconcile'): Promise<void>;
}
