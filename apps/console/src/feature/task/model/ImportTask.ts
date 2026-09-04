export type ImportKind = 'member' | 'catalog' | 'voucher';
export type ImportState = 'uploaded' | 'validating' | 'ready' | 'running' | 'reporting' | 'completed' | 'failed' | 'cancelled';
export interface ImportIssue {
  readonly row: number;
  readonly code: string;
  readonly field: string | null;
  readonly detail: string;
}
export interface ImportReport {
  readonly sha256: string;
  readonly size: number;
  readonly download: string;
}
export interface ImportValidation {
  readonly format?: string;
  readonly rows?: number;
  readonly columns?: readonly string[];
  readonly shardSize?: number;
  readonly processed?: number;
  readonly errors?: number;
  readonly encryptedStaging?: boolean;
  readonly code?: string;
}
export interface ImportTask {
  readonly id: string;
  readonly kind: ImportKind;
  readonly state: ImportState;
  readonly totalCount: number;
  readonly cursor: number;
  readonly successCount: number;
  readonly failureCount: number;
  readonly validation: ImportValidation;
  readonly lastError: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly issues: readonly ImportIssue[];
  readonly report?: ImportReport;
}
export const importKinds: readonly ImportKind[] = Object.freeze(['member', 'catalog', 'voucher']);
