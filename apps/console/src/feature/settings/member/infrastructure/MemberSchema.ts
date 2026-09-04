import { exactOperationOutput } from '@shop/contract/schema';

export const MemberPageDtoSchema = exactOperationOutput('MemberMembersReadOutput');
export const MemberReceiptDtoSchema = exactOperationOutput('IdentityMembersManageOutput');
export const MemberImportTaskDtoSchema = exactOperationOutput('MemberImportsCreateOutput');

export interface MemberPageDto {
  readonly items: readonly Readonly<{
    id: string;
    display_name: string;
    status: string;
    membership_id: string;
    organization_id: string;
    employee_no: string | null;
    membership_status: string;
    access_version: number;
    joined_at: string | null;
  }>[];
  readonly count: number;
  readonly nextCursor?: string;
}
