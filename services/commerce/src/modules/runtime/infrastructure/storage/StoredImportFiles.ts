import type { ImportFilePort } from '../../application/port/ImportFilePort';
import type { ImportFailure, ImportOwner } from '../../public/ImportProcess';
import type { ObjectStore, StoredObject } from '../../public/ObjectPort';
import { readImportFile, saveImportReport } from './ImportFile';

export class StoredImportFiles implements ImportFilePort {
  constructor(private readonly objects: ObjectStore) {}
  read(reference: string, sha256: string, maximumBytes: number, maximumRows: number): AsyncIterable<Readonly<Record<string, string>>> {
    return readImportFile(this.objects, reference, sha256, maximumBytes, maximumRows);
  }
  report(owner: ImportOwner, id: string, failures: readonly ImportFailure[]): Promise<StoredObject> {
    return saveImportReport(this.objects, owner, id, failures);
  }
}
