import type { OperationDatabase } from '../../../../foundation/application/ModuleOperations';

export interface CatalogSku {
  find(database: OperationDatabase, scope: string, reference: string): Promise<string | null>;
}
