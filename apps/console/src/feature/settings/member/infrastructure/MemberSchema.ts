import type { OperationOutputFor } from '@shop/contract';
import { exactOperationOutput } from '@shop/contract/schema';

export const MemberPageDtoSchema = exactOperationOutput('MemberMembersReadOutput');
export const MemberReceiptDtoSchema = exactOperationOutput('IdentityMembersManageOutput');
export const MemberImportTaskDtoSchema = exactOperationOutput('MemberImportsCreateOutput');

export type MemberPageDto = OperationOutputFor<'member.members.read'>;
