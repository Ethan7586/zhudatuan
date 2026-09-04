import type { OperationBodyFor, OperationOutputFor } from '@shop/contract';

type SyncRunDto = OperationOutputFor<'organization.directories.syncruns.read'>['items'][number];
type SyncReceiptDto = OperationOutputFor<'organization.directories.sync'>;
export type SyncMode = SyncRunDto['mode'];
export type SyncState = SyncRunDto['state'];
export type DirectorySyncMode = SyncReceiptDto['mode'];
export type DirectorySyncAction = OperationBodyFor<'OrganizationDirectoriesSyncInput'>['action'];

export interface DirectorySyncRun {
  readonly id: string;
  readonly mode: SyncMode;
  readonly state: SyncState;
  readonly preview: boolean;
  readonly readCount: number;
  readonly appliedCount: number;
  readonly createCount: number;
  readonly updateCount: number;
  readonly freezeCount: number;
  readonly restoreCount: number;
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
  | Readonly<{ action: Extract<DirectorySyncAction, 'start'>; directory: string; mode: DirectorySyncMode; proof: string; identity: string }>
  | Readonly<{ action: Extract<DirectorySyncAction, 'preview'>; directory: string; mode: DirectorySyncMode; proof: string; identity: string }>
  | Readonly<{ action: Extract<DirectorySyncAction, 'cancel'>; directory: string; run: string; mode: DirectorySyncMode; proof: string; identity: string }>
  | Readonly<{ action: Extract<DirectorySyncAction, 'resume'>; directory: string; run: string; mode: DirectorySyncMode; proof: string; identity: string }>;

export interface SyncReceipt {
  readonly id: string;
  readonly state: SyncReceiptDto['state'];
  readonly mode: SyncReceiptDto['mode'];
  readonly preview: boolean;
}
