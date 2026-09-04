import { IMPORT_CAPACITY } from '@shop/config/runtime';
import type { ObjectStore } from '../../public/ObjectPort';
import type { TabularFilePort } from '../../public/TabularFilePort';
import { readImportFile } from './ImportFile';

export class RuntimeTabularFiles implements TabularFilePort {
  constructor(private readonly objects: ObjectStore) {}

  async *batches(reference: string, sha256: string): AsyncIterable<readonly Readonly<Record<string, string>>[]> {
    let batch: Readonly<Record<string, string>>[] = [];
    for await (const row of readImportFile(this.objects, reference, sha256, IMPORT_CAPACITY.maximumFileBytes, IMPORT_CAPACITY.maximumRows)) {
      batch.push(row);
      if (batch.length < IMPORT_CAPACITY.chunkRows) continue;
      yield Object.freeze(batch);
      batch = [];
    }
    if (batch.length > 0) yield Object.freeze(batch);
  }
}
