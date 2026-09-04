export type SyncMode = 'full' | 'incremental' | 'event' | 'reconcile';
export type SyncState = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
export interface SyncRunValue {
  readonly id: string;
  readonly connectionid: string;
  readonly providerrunid: string;
  readonly mode: SyncMode;
  readonly preview: boolean;
  readonly state: SyncState;
  readonly cursor: string | null;
  readonly read: number;
  readonly applied: number;
  readonly creates: number;
  readonly updates: number;
  readonly freezes: number;
  readonly restores: number;
  readonly conflicts: number;
  readonly ignored: number;
}
export class SyncRun implements SyncRunValue {
  readonly id: string;
  readonly connectionid: string;
  readonly providerrunid: string;
  readonly mode: SyncMode;
  readonly preview: boolean;
  readonly state: SyncState;
  readonly cursor: string | null;
  readonly read: number;
  readonly applied: number;
  readonly creates: number;
  readonly updates: number;
  readonly freezes: number;
  readonly restores: number;
  readonly conflicts: number;
  readonly ignored: number;
  constructor(value: SyncRunValue) {
    if (
      !['full', 'incremental', 'event', 'reconcile'].includes(value.mode) ||
      typeof value.preview !== 'boolean' ||
      !['queued', 'running', 'completed', 'failed', 'cancelled'].includes(value.state) ||
      [value.read, value.applied, value.creates, value.updates, value.freezes, value.restores, value.conflicts, value.ignored].some((item) => !Number.isSafeInteger(item) || item < 0) ||
      value.creates + value.updates + value.freezes + value.restores !== value.applied ||
      value.applied + value.conflicts + value.ignored > value.read
    )
      throw new Error('DIRECTORY_SYNC_RUN_INVALID');
    this.id = value.id;
    this.connectionid = value.connectionid;
    this.providerrunid = value.providerrunid;
    this.mode = value.mode;
    this.preview = value.preview;
    this.state = value.state;
    this.cursor = value.cursor;
    this.read = value.read;
    this.applied = value.applied;
    this.creates = value.creates;
    this.updates = value.updates;
    this.freezes = value.freezes;
    this.restores = value.restores;
    this.conflicts = value.conflicts;
    this.ignored = value.ignored;
    Object.freeze(this);
  }
  start(): SyncRun {
    if (this.state !== 'queued' && this.state !== 'running') throw new Error('DIRECTORY_SYNC_STATE_INVALID');
    return new SyncRun({ ...this, state: 'running' });
  }
}
