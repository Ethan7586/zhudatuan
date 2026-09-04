export type SyncMode = 'full' | 'incremental' | 'event' | 'reconcile';
export type SyncState = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface DirectorySyncRun {
  readonly id: string;
  readonly mode: SyncMode;
  readonly state: SyncState;
  readonly readCount: number;
  readonly appliedCount: number;
  readonly conflictCount: number;
  readonly ignoredCount: number;
  readonly watermark: string | null;
  readonly startedAt: string | null;
  readonly completedAt: string | null;
  readonly createdAt: string;
}

export interface SyncRunPage {
  readonly items: readonly DirectorySyncRun[];
  readonly count: number;
  readonly nextCursor?: string;
}

export type DirectoryCommand =
  | Readonly<{ action: 'start'; directory: string; mode: 'full' | 'incremental'; proof: string; identity: string }>
  | Readonly<{ action: 'cancel'; directory: string; run: string; mode: 'full' | 'incremental'; proof: string; identity: string }>
  | Readonly<{ action: 'resume'; directory: string; run: string; mode: 'full' | 'incremental'; proof: string; identity: string }>;

export interface SyncReceipt {
  readonly id: string;
  readonly state: SyncState;
  readonly mode: 'full' | 'incremental';
}
