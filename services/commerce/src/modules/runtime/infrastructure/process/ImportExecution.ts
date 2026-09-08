import type { ImportBatchConfiguration, ImportBatchFactoryPort, ImportOwner, ImportRunnerPort, BatchImportProcessPort } from '../../public/ImportProcess';
import type { ObjectStore } from '../../public/ObjectPort';
import { RunImport } from '../../application/process/RunImport';
import { RuntimeBatchImportProcess } from '../../application/process/StageImport';
import { StoredImportFiles } from '../storage/StoredImportFiles';

export class RuntimeImportExecution implements ImportRunnerPort, ImportBatchFactoryPort {
  private readonly files: StoredImportFiles;
  constructor(objects: ObjectStore) {
    this.files = new StoredImportFiles(objects);
  }

  create(configuration: ImportBatchConfiguration): BatchImportProcessPort {
    return new RuntimeBatchImportProcess(configuration);
  }

  execute(owner: ImportOwner, process: BatchImportProcessPort, id: string, scope: string, signal: AbortSignal, deadline: number): Promise<void> {
    return new RunImport(owner, this.files, process).execute(id, scope, signal, deadline);
  }
}
