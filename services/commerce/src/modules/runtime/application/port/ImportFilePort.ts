import type { ImportFailure, ImportOwner } from '../../public/ImportProcess';
import type { StoredObject } from '../../public/ObjectPort';

export interface ImportFilePort {
  read(reference: string, sha256: string, maximumBytes: number, maximumRows: number): AsyncIterable<Readonly<Record<string, string>>>;
  report(owner: ImportOwner, id: string, failures: readonly ImportFailure[]): Promise<StoredObject>;
}
