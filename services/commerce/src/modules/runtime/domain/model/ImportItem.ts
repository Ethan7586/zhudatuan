import type { TaskFailure } from '../value/Failure';

export class ImportItem {
  constructor(
    readonly row: number,
    readonly state: 'pending' | 'running' | 'succeeded' | 'failed',
    readonly failure: TaskFailure | null
  ) {
    if (!Number.isSafeInteger(row) || row < 1 || (state === 'failed') !== (failure !== null)) throw new Error('RUNTIME_IMPORT_ITEM_INVALID');
    Object.freeze(this);
  }
}
