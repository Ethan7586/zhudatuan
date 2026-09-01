import { ProcessBatchImport } from '../../../../foundation/application/process/ProcessBatchImport';
import type { ObjectStore } from '../../../../foundation/infrastructure/ObjectStore';
import type { ImportProcessPort } from '../port/ImportProcessPort';

export class InventoryImportProcess extends ProcessBatchImport {
  constructor(objects: ObjectStore, process: ImportProcessPort) {
    super('inventory', objects, process);
  }
}
