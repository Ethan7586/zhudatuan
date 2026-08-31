export type SyncMode = 'full' | 'incremental' | 'event' | 'reconcile';
export type SyncState = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
export interface SyncRunValue {
  readonly id: string;
  readonly connectionid: string;
  readonly providerrunid: string;
  readonly mode: SyncMode;
  readonly state: SyncState;
  readonly cursor: string | null;
  readonly read: number;
  readonly applied: number;
  readonly conflicts: number;
  readonly ignored: number;
}
export class SyncRun implements SyncRunValue {
  readonly id: string;
  readonly connectionid: string;
  readonly providerrunid: string;
  readonly mode: SyncMode;
  readonly state: SyncState;
  readonly cursor: string | null;
  readonly read: number;
  readonly applied: number;
  readonly conflicts: number;
  readonly ignored: number;
  constructor(value: SyncRunValue) {
    if (
      !['full', 'incremental', 'event', 'reconcile'].includes(value.mode) ||
      !['queued', 'running', 'completed', 'failed', 'cancelled'].includes(value.state) ||
      [value.read, value.applied, value.conflicts, value.ignored].some((item) => !Number.isSafeInteger(item) || item < 0) ||
      value.applied + value.conflicts + value.ignored > value.read
    )
      throw new Error('DIRECTORY_SYNC_RUN_INVALID');
    this.id = value.id;
    this.connectionid = value.connectionid;
    this.providerrunid = value.providerrunid;
    this.mode = value.mode;
    this.state = value.state;
    this.cursor = value.cursor;
    this.read = value.read;
    this.applied = value.applied;
    this.conflicts = value.conflicts;
    this.ignored = value.ignored;
    Object.freeze(this);
  }
  start(): SyncRun {
    if (this.state !== 'queued' && this.state !== 'running') throw new Error('DIRECTORY_SYNC_STATE_INVALID');
    return new SyncRun({ ...this, state: 'running' });
  }
}
