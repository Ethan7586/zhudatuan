import type { OperationOutputFor } from '@shop/contract';

type DirectoryDto = OperationOutputFor<'organization.directories.read'>['items'][number];
export type DirectoryType = DirectoryDto['type'];
export type DirectoryStatus = DirectoryDto['status'];

export interface Directory {
  readonly id: string;
  readonly organizationId: string;
  readonly type: DirectoryType;
  readonly status: DirectoryStatus;
  readonly successfulVersion: number;
  readonly version: number;
  readonly updatedAt: string;
  readonly lastSuccessAt: string | null;
}

export interface DirectoryPage {
  readonly items: readonly Directory[];
  readonly count: number;
  readonly nextCursor?: string;
}
