import { exactOperationOutput } from '@shop/contract/schema';
import type { DirectoryStatus, DirectoryType } from '../model/Directory';
import type { SyncMode, SyncState } from '../model/SyncRun';

export const DirectoryPageDtoSchema = exactOperationOutput('OrganizationDirectoriesReadOutput');
export const SyncRunPageDtoSchema = exactOperationOutput('OrganizationDirectoriesSyncrunsReadOutput');
export const SyncReceiptDtoSchema = exactOperationOutput('OrganizationDirectoriesSyncOutput');

export interface DirectoryDto {
  readonly id: string;
  readonly organization_id: string;
  readonly type: DirectoryType;
  readonly status: DirectoryStatus;
  readonly successful_version: number;
  readonly version: number;
  readonly updated_at: string;
  readonly last_success_at: string | null;
}
export interface SyncRunDto {
  readonly id: string;
  readonly mode: SyncMode;
  readonly state: SyncState;
  readonly read_count: number;
  readonly applied_count: number;
  readonly conflict_count: number;
  readonly ignored_count: number;
  readonly watermark: string | null;
  readonly started_at: string | null;
  readonly completed_at: string | null;
  readonly created_at: string;
}
