import { deepFreeze } from '../../../../shared/model/Immutable';
import type { MemberImportTask, MemberPage, MemberReceipt, RegistrationResetReceipt } from '../model/Member';
import { MemberImportTaskDtoSchema, MemberPageDtoSchema, MemberReceiptDtoSchema } from './MemberSchema';

export class MemberMapper {
  page(value: unknown): MemberPage {
    const page = MemberPageDtoSchema.parse(value);
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
        loginIdentityBound: item.login_identity_bound,
        registrationResetAllowed: item.registration_reset_allowed,
        registrationResetBlockReason: item.registration_reset_block_reason,
      })),
      count: page.count,
      ...(page.nextCursor === undefined ? {} : { nextCursor: page.nextCursor }),
    });
  }

  receipt(value: unknown): MemberReceipt {
    const item = MemberReceiptDtoSchema.parse(value);
    if (item.action === 'update') return Object.freeze({ referenceId: item.memberId, kind: 'profile', version: item.version });
    if (item.action === 'enable' || item.action === 'disable' || item.action === 'offboard') {
      return Object.freeze({ referenceId: item.membershipId, kind: 'status', version: item.accessVersion });
    }
    throw new Error('MEMBER_CHANGE_RECEIPT_INVALID');
  }

  registrationReset(value: unknown): RegistrationResetReceipt {
    const item = MemberReceiptDtoSchema.parse(value);
    if (item.action !== 'registrationReset') throw new Error('MEMBER_REGISTRATION_RESET_RECEIPT_INVALID');
    return Object.freeze({
      memberId: item.memberId,
      principalId: item.principalId,
      status: item.status,
      loginIdentityReleased: item.loginIdentityReleased,
      historyRetained: item.historyRetained,
      memberships: Object.freeze([...item.memberships]),
      accessVersion: item.accessVersion,
      profileVersion: item.profileVersion,
      principalVersion: item.principalVersion,
    });
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
