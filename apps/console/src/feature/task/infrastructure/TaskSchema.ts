import { exactOperationOutput } from '@shop/contract/schema';
export const MemberImportDtoSchema = exactOperationOutput('MemberImportsReadOutput');
export const CatalogImportDtoSchema = exactOperationOutput('CatalogImportsReadOutput');
export const VoucherImportDtoSchema = exactOperationOutput('VoucherImportsReadOutput');
export interface ImportTaskDto {
  readonly id: string;
  readonly state: string;
  readonly total_count: number;
  readonly cursor_value: number;
  readonly success_count: number;
  readonly failure_count: number;
  readonly validation_summary: unknown;
  readonly last_error: string | null;
  readonly created_at: string;
  readonly updated_at: string;
  readonly errors: readonly Readonly<{ row_number: number; reason_code: string; field: string | null; detail: unknown }>[];
  readonly report?: Readonly<{ sha256: string; size: number; download: string }>;
}
