import { channelFailure, type ChannelFailure } from './Failure';

export type SyncKind = 'catalog' | 'price' | 'stock' | 'statement';
export type SyncState = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
export type SyncPhase = 'pull' | 'apply' | 'commit';

export interface SyncProgress {
  readonly pulled: number;
  readonly accepted: number;
  readonly rejected: number;
  readonly phase: SyncPhase;
  readonly cursor: string | null;
  readonly watermark: string | null;
}

export interface SyncRunSnapshot {
  readonly id: string;
  readonly connection: string;
  readonly kind: SyncKind;
  readonly state: SyncState;
  readonly inputHash: string;
  readonly progress: SyncProgress;
  readonly failure: ChannelFailure | null;
  readonly version: number;
}

export class SyncRun {
  readonly id: string;
  readonly connection: string;
  readonly kind: SyncKind;
  readonly state: SyncState;
  readonly inputHash: string;
  readonly progress: SyncProgress;
  readonly failure: ChannelFailure | null;
  readonly version: number;

  constructor(value: SyncRunSnapshot) {
    if (!value.id.trim() || !value.connection.trim() || !/^[a-f0-9]{64}$/.test(value.inputHash) || !Number.isSafeInteger(value.version) || value.version < 0) {
      throw new Error('CHANNEL_SYNC_RUN_INVALID');
    }
    const { progress } = value;
    if ([progress.pulled, progress.accepted, progress.rejected].some((count) => !Number.isSafeInteger(count) || count < 0) ||
      progress.accepted + progress.rejected > progress.pulled || progress.cursor !== null && !progress.cursor.trim() ||
      progress.watermark !== null && Number.isNaN(Date.parse(progress.watermark))) throw new Error('CHANNEL_SYNC_PROGRESS_INVALID');
    const failure = channelFailure(value.failure);
    if ((value.state === 'failed') !== (failure !== null)) throw new Error('CHANNEL_SYNC_FAILURE_INVALID');
    this.id = value.id;
    this.connection = value.connection;
    this.kind = value.kind;
    this.state = value.state;
    this.inputHash = value.inputHash;
    this.progress = Object.freeze({ ...progress });
    this.failure = failure;
    this.version = value.version;
    Object.freeze(this);
  }
}
