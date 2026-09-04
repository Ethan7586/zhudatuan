export type DirectoryType = 'wecomcorp' | 'wecomsuite';
export type DirectoryStatus = 'draft' | 'enabled' | 'paused' | 'disabled' | 'revoked';

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
