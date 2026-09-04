export type SyncKind = 'catalog' | 'price' | 'stock' | 'statement';
export type SyncState = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface SyncProgress {
  readonly pulled: number;
  readonly accepted: number;
  readonly rejected: number;
  readonly cursor: string | null;
  readonly watermark: string | null;
}

export class SyncRun {
  constructor(readonly id: string, readonly connection: string, readonly kind: SyncKind, readonly state: SyncState,
    readonly inputHash: string, readonly progress: SyncProgress) {
    if (!id || !connection || !/^[a-f0-9]{64}$/.test(inputHash)) throw new Error('CHANNEL_SYNC_RUN_INVALID');
    if ([progress.pulled, progress.accepted, progress.rejected].some((value) => !Number.isSafeInteger(value) || value < 0)
      || progress.accepted + progress.rejected > progress.pulled) throw new Error('CHANNEL_SYNC_PROGRESS_INVALID');
  }
}
