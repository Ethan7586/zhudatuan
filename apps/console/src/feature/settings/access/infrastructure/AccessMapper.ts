import {
  OP_ACCESS_OVERRIDES_MANAGE,
  OP_ACCESS_OWNERSHIP_TRANSFERS_ACCEPT,
  OP_ACCESS_OWNERSHIP_TRANSFERS_CANCEL,
  OP_ACCESS_OWNERSHIP_TRANSFERS_CREATE,
  OP_ACCESS_ROLES_MANAGE,
  OP_ACCESS_SCOPES_MANAGE,
} from '@shop/contract/ids';
import type { AccessMembership, AccessPage, AccessReceipt, AccessRole, AccessScope, OwnerChange, Ownership, OwnershipImpact, OwnershipPreview, OwnershipTransfer } from '../model/Access';
import {
  AccessPageDtoSchema,
  OverrideReceiptDtoSchema,
  OwnershipAcceptDtoSchema,
  OwnershipAcceptPreviewDtoSchema,
  OwnershipCancelDtoSchema,
  OwnershipCancelPreviewDtoSchema,
  OwnershipCreateDtoSchema,
  OwnershipCreatePreviewDtoSchema,
  OwnershipDtoSchema,
  RoleReceiptDtoSchema,
  ScopeReceiptDtoSchema,
  type AccessPageDto,
  type OwnershipDto,
  type OwnershipImpactDto,
  type OwnershipTransferDto,
} from './AccessSchema';

export class AccessMapper {
  page(value: unknown): AccessPage {
    const dto = AccessPageDtoSchema.parse(value);
    const items = dto.items.map((item) => membership(item));
    if (items.length !== dto.count) throw new Error('ACCESS_PAGE_COUNT_MISMATCH');
    return Object.freeze({
      items: Object.freeze(items),
      roles: Object.freeze(dto.roles.map((role): AccessRole => Object.freeze({
        ...role,
        allows: Object.freeze([...role.allows]),
        denies: Object.freeze([...role.denies]),
        members: Object.freeze(role.members.map((member) => Object.freeze({ ...member }))),
      }))),
      templates: Object.freeze(dto.templates.map((template) => Object.freeze({ ...template, allows: Object.freeze([...template.allows]), denies: Object.freeze([...template.denies]) }))),
      separationRules: Object.freeze(dto.separationRules.map((rule) => Object.freeze({ ...rule }))),
      count: dto.count,
      ...(dto.nextCursor === undefined ? {} : { nextCursor: dto.nextCursor }),
    });
  }

  ownership(value: unknown): Ownership {
    return ownership(OwnershipDtoSchema.parse(value));
  }

  ownershipPreview(change: OwnerChange, value: unknown): OwnershipPreview {
    if (change.action === 'create') {
      const dto = OwnershipCreatePreviewDtoSchema.parse(value);
      return Object.freeze({ action: 'create', state: dto.state, formerOwnerMode: dto.formerOwnerMode, formerOwnerRole: dto.formerOwnerRole, coolingUntil: dto.coolingUntil, expiresAt: dto.expiresAt, impact: ownershipImpact(dto) });
    }
    if (change.action === 'accept') {
      const dto = OwnershipAcceptPreviewDtoSchema.parse(value);
      return Object.freeze({ action: 'accept', transfer: ownershipTransfer(dto.transfer), impact: ownershipImpact(dto.impact) });
    }
    const dto = OwnershipCancelPreviewDtoSchema.parse(value);
    return Object.freeze({ action: 'cancel', transfer: ownershipTransfer(dto.transfer), impact: ownershipImpact(dto.impact), reason: dto.reason });
  }

  owner(change: OwnerChange, value: unknown): AccessReceipt {
    if (change.action === 'create') {
      const dto = OwnershipCreateDtoSchema.parse(value);
      return receipt(OP_ACCESS_OWNERSHIP_TRANSFERS_CREATE, dto.id, dto.version, '所有权转移申请已发起，等待新所有者接受。');
    }
    if (change.action === 'accept') {
      const dto = OwnershipAcceptDtoSchema.parse(value);
      return receipt(OP_ACCESS_OWNERSHIP_TRANSFERS_ACCEPT, dto.transfer.id, dto.ownership.version, '所有权已切换，双方权限版本已更新。');
    }
    const dto = OwnershipCancelDtoSchema.parse(value);
    return receipt(OP_ACCESS_OWNERSHIP_TRANSFERS_CANCEL, dto.id, dto.version, '所有权转移申请已取消。');
  }

  role(value: unknown): AccessReceipt {
    const dto = RoleReceiptDtoSchema.parse(value);
    if (dto.action === 'save') return receipt(OP_ACCESS_ROLES_MANAGE, dto.id, dto.version, '自定义角色已保存，受影响成员的权限版本已更新。');
    if (dto.action === 'status') return receipt(OP_ACCESS_ROLES_MANAGE, dto.id, dto.version, dto.status === 'active' ? '角色已启用。' : '角色已停用。');
    if (dto.action === 'assign' || dto.action === 'revoke') return receipt(OP_ACCESS_ROLES_MANAGE, dto.targetMembership, dto.accessVersion, dto.action === 'assign' ? '角色已授予成员。' : '成员角色已撤销。');
    if (dto.action === 'delete') return receipt(OP_ACCESS_ROLES_MANAGE, dto.id, dto.version, '未使用的自定义角色已删除。');
    throw new Error('ACCESS_ROLE_RECEIPT_ACTION_INVALID');
  }

  override(value: unknown): AccessReceipt {
    const dto = OverrideReceiptDtoSchema.parse(value);
    return receipt(OP_ACCESS_OVERRIDES_MANAGE, dto.targetMembership, dto.accessVersion, dto.revoked ? '覆盖权限已撤销。' : '覆盖权限已更新。');
  }

  scope(value: unknown): AccessReceipt {
    const dto = ScopeReceiptDtoSchema.parse(value);
    return receipt(OP_ACCESS_SCOPES_MANAGE, dto.membershipId, dto.accessVersion, '项目范围已更新。');
  }
}

function membership(dto: AccessPageDto['items'][number]): AccessMembership {
  return Object.freeze({
    id: dto.id,
    displayName: dto.display_name,
    employeeNo: dto.employee_no,
    mobileMasked: dto.mobile_masked,
    client: dto.client,
    status: dto.status,
    accessVersion: dto.access_version,
    roles: Object.freeze(dto.roles.map((role): AccessRole => Object.freeze({ id: role.role, name: role.name, description: role.description, status: role.status, kind: role.kind, template: role.template, version: role.version, allows: Object.freeze([...role.allows]), denies: Object.freeze([...role.denies]), affectedPeople: 0, affectedScopes: 0, members: Object.freeze([]) }))),
    scopes: Object.freeze(dto.scopes.map((scope): AccessScope => Object.freeze({ id: scope.id, kind: scope.kind, resource: scope.scope, effect: scope.effect, expiresAt: scope.expires }))),
    overrides: Object.freeze(dto.overrides.map((override) => Object.freeze({ permission: override.permission, effect: override.effect, expiresAt: override.expires }))),
  });
}

function ownership(dto: OwnershipDto): Ownership {
  return Object.freeze({
    state: dto.state,
    version: dto.version,
    mobileReady: dto.mobileReady,
    owner: Object.freeze({ ...dto.owner }),
    candidates: Object.freeze(dto.candidates.map((candidate) => Object.freeze({ ...candidate, roles: Object.freeze([...candidate.roles]) }))),
    formerOwnerRoles: Object.freeze(dto.formerOwnerRoles.map((role) => Object.freeze({ ...role }))),
    pending: dto.pending === null ? null : ownershipTransfer(dto.pending),
  });
}

function ownershipTransfer(dto: OwnershipTransferDto): OwnershipTransfer {
  return Object.freeze({ ...dto });
}

function ownershipImpact(dto: OwnershipImpactDto): OwnershipImpact {
  return Object.freeze({ ...dto, warnings: Object.freeze([...dto.warnings]) });
}

function receipt(operation: AccessReceipt['operation'], reference: string, version: number, message: string): AccessReceipt {
  return Object.freeze({ operation, reference, version, message });
}
