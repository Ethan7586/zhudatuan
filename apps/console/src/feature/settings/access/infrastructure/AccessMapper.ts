import { OP_ACCESS_OVERRIDES_MANAGE, OP_ACCESS_OWNERS_TRANSFER, OP_ACCESS_ROLES_MANAGE, OP_ACCESS_SCOPES_MANAGE } from '@shop/contract/ids';
import type { AccessMembership, AccessPage, AccessReceipt, AccessRole, AccessScope } from '../model/Access';
import { AccessPageDtoSchema, OverrideReceiptDtoSchema, OwnerReceiptDtoSchema, RoleReceiptDtoSchema, ScopeReceiptDtoSchema, type AccessPageDto } from './AccessSchema';

export class AccessMapper {
  page(value: unknown): AccessPage {
    const dto = AccessPageDtoSchema.parse(value) as AccessPageDto;
    const items = dto.items.map((item) => membership(item));
    if (items.length !== dto.count) throw new Error('ACCESS_PAGE_COUNT_MISMATCH');
    return Object.freeze({ items: Object.freeze(items), count: dto.count, ...(dto.nextCursor === undefined ? {} : { nextCursor: dto.nextCursor }) });
  }

  owner(value: unknown): AccessReceipt {
    const dto = OwnerReceiptDtoSchema.parse(value);
    return receipt(OP_ACCESS_OWNERS_TRANSFER, dto.membership, dto.version, '所有权已转移，双方权限版本已更新。');
  }

  role(value: unknown): AccessReceipt {
    const dto = RoleReceiptDtoSchema.parse(value);
    return receipt(OP_ACCESS_ROLES_MANAGE, dto.id, dto.version, '自定义角色已更新。');
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
    roles: Object.freeze(dto.roles.map((role): AccessRole => Object.freeze({ id: role.role, name: role.name, kind: role.kind, version: role.version, allows: Object.freeze([...role.allows]), denies: Object.freeze([...role.denies]) }))),
    scopes: Object.freeze(dto.scopes.map((scope): AccessScope => Object.freeze({ id: scope.id, kind: scope.kind, resource: scope.scope, effect: scope.effect, expiresAt: scope.expires }))),
    overrides: Object.freeze(dto.overrides.map((override) => Object.freeze({ permission: override.permission, effect: override.effect, expiresAt: override.expires }))),
  });
}

function receipt(operation: AccessReceipt['operation'], reference: string, version: number, message: string): AccessReceipt {
  return Object.freeze({ operation, reference, version, message });
}
