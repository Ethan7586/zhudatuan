import { deepFreeze } from '../../../../shared/model/Immutable';
import type { MemberImportTask, MemberPage, MemberReceipt } from '../model/Member';
import { MemberImportTaskDtoSchema, MemberPageDtoSchema, MemberReceiptDtoSchema, type MemberPageDto } from './MemberSchema';

export class MemberMapper {
  page(value: unknown): MemberPage {
    const page = MemberPageDtoSchema.parse(value) as MemberPageDto;
    if (page.items.length !== page.count) throw new Error('MEMBER_PAGE_COUNT_MISMATCH');
    return deepFreeze({
      items: page.items.map((item) => ({
        id: item.id,
        displayName: item.display_name,
        profileStatus: item.status,
        membershipId: item.membership_id,
        organizationId: item.organization_id,
        employeeNo: item.employee_no,
        membershipStatus: item.membership_status,
        accessVersion: item.access_version,
        joinedAt: item.joined_at,
      })),
      count: page.count,
      ...(page.nextCursor === undefined ? {} : { nextCursor: page.nextCursor }),
    });
  }

  receipt(value: unknown): MemberReceipt {
    const item = MemberReceiptDtoSchema.parse(value);
    return item.action === 'update' ? Object.freeze({ referenceId: item.memberId, kind: 'profile', version: item.version }) : Object.freeze({ referenceId: item.membershipId, kind: 'status', version: item.accessVersion });
  }

  importTask(value: unknown): MemberImportTask {
    const item = MemberImportTaskDtoSchema.parse(value);
    return Object.freeze({
      id: item.id,
      state: item.state,
      totalCount: item.total_count,
      cursor: item.cursor_value,
      successCount: item.success_count,
      failureCount: item.failure_count,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
    });
  }
}
