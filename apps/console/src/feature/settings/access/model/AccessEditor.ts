import type { AccessChange, AccessEffect, AccessMembership, AccessOverrideAction, AccessRole, AccessRoleMembershipAction, AccessRoleState, AccessScopeKind, FormerOwnerMode, Ownership, OwnershipPreview, OwnershipTransfer, RoleTemplateCode } from './Access';

interface EditorBase {
  readonly proof: string;
  readonly confirmed: boolean;
}
export type AccessEditor =
  | (EditorBase & Readonly<{ kind: 'role'; action: 'save'; role: AccessRole; name: string; description: string; template: RoleTemplateCode; allows: readonly string[]; denies: readonly string[]; step: 1 | 2 | 3 }>)
  | (EditorBase & Readonly<{ kind: 'role'; action: 'status'; role: AccessRole; status: AccessRoleState }>)
  | (EditorBase & Readonly<{ kind: 'role'; action: AccessRoleMembershipAction; role: AccessRole; membership: AccessMembership }>)
  | (EditorBase & Readonly<{ kind: 'role'; action: 'delete'; role: AccessRole }>)
  | (EditorBase & Readonly<{ kind: 'override'; membership: AccessMembership; action: AccessOverrideAction; permission: string; effect: AccessEffect; expiresAt: string; reason: string }>)
  | (EditorBase & Readonly<{ kind: 'scope'; membership: AccessMembership; scopeKind: AccessScopeKind; resource: string; effect: AccessEffect; expiresAt: string }>)
  | (EditorBase & Readonly<{
      kind: 'owner';
      action: 'create' | 'accept' | 'cancel';
      ownership: Ownership;
      transfer: OwnershipTransfer | null;
      targetId: string;
      formerOwnerMode: FormerOwnerMode;
      formerOwnerRole: string;
      reason: string;
      preview?: OwnershipPreview;
    }>);

export function buildAccessChange(editor: AccessEditor): AccessChange | undefined {
  if (editor.kind === 'role') {
    if (editor.action === 'save') return Object.freeze({ kind: 'role', action: 'save', role: editor.role, name: editor.name, description: editor.description, template: editor.template, allows: editor.allows, denies: editor.denies });
    if (editor.action === 'status') return Object.freeze({ kind: 'role', action: 'status', role: editor.role, status: editor.status });
    if (editor.action === 'assign' || editor.action === 'revoke') return Object.freeze({ kind: 'role', action: editor.action, role: editor.role, membership: editor.membership });
    return Object.freeze({ kind: 'role', action: 'delete', role: editor.role });
  }
  if (editor.kind === 'override')
    return Object.freeze({
      kind: 'override',
      membership: editor.membership,
      action: editor.action,
      permission: editor.permission.trim(),
      effect: editor.effect,
      ...(editor.expiresAt ? { expiresAt: new Date(editor.expiresAt).toISOString() } : {}),
      reason: editor.reason.trim(),
    });
  if (editor.kind === 'scope')
    return Object.freeze({
      kind: 'scope',
      membership: editor.membership,
      scopeKind: editor.scopeKind,
      resource: editor.resource.trim(),
      effect: editor.effect,
      ...(editor.expiresAt ? { expiresAt: new Date(editor.expiresAt).toISOString() } : {}),
    });
  if (editor.action === 'create') {
    const target = editor.ownership.candidates.find((item) => item.membership === editor.targetId);
    if (target === undefined) return undefined;
    return Object.freeze({
      kind: 'owner',
      action: 'create',
      ownership: editor.ownership,
      target,
      formerOwnerMode: editor.formerOwnerMode,
      formerOwnerRole: editor.formerOwnerMode === 'retain_admin' ? editor.formerOwnerRole || null : null,
      reason: editor.reason.trim(),
    });
  }
  if (editor.transfer === null) return undefined;
  return editor.action === 'accept'
    ? Object.freeze({ kind: 'owner', action: 'accept', ownership: editor.ownership, transfer: editor.transfer })
    : Object.freeze({ kind: 'owner', action: 'cancel', ownership: editor.ownership, transfer: editor.transfer, reason: editor.reason.trim() });
}

export function validateAccessChange(editor: AccessEditor | undefined, change: AccessChange | undefined, assurance: number): string | undefined {
  if (editor === undefined) return undefined;
  const body = validateAccessBody(editor, change);
  if (body) return body;
  if (assurance < 3) return '请先完成高强度二次验证。';
  if (!editor.confirmed) return editor.kind === 'owner' ? ownerConfirmation(editor) : '请确认目标、版本与修改内容。';
  if (!/^[A-Za-z0-9_-]{43,128}$/.test(editor.proof)) return '请输入另一位管理员签发的一次性操作凭证。';
  return undefined;
}

export function validateAccessBody(editor: AccessEditor | undefined, change: AccessChange | undefined): string | undefined {
  if (editor === undefined || change === undefined) return '请选择有效目标。';
  if (change.kind === 'role' && change.action === 'save' && (change.name.trim().length === 0 || change.name.trim().length > 120)) return '角色名称需为 1 至 120 个字符。';
  if (change.kind === 'role' && change.action === 'save' && (change.description.trim().length < 4 || change.description.trim().length > 300)) return '角色说明需为 4 至 300 个字符。';
  if (change.kind === 'override' && (change.permission.length === 0 || change.reason.length < 4 || change.reason.length > 500)) return '请选择权限并填写 4 至 500 字的审计原因。';
  if (change.kind === 'scope' && change.resource.length === 0) return '请输入有效的项目或资源标识。';
  if (change.kind === 'owner' && change.action !== 'accept' && (change.reason.length < 4 || change.reason.length > 500)) return '请填写 4 至 500 字的所有权转移原因。';
  if (change.kind === 'owner' && change.action === 'create' && (!change.ownership.mobileReady || !change.target.mobileReady)) return '当前所有者和新所有者都必须先绑定可用于二次验证的手机。';
  if (change.kind === 'owner' && change.action === 'create' && change.formerOwnerMode === 'retain_admin' && change.formerOwnerRole === null) return '请选择原所有者转移后保留的管理员角色。';
  return undefined;
}

export function selectPermission(values: readonly string[], permission: string, selected: boolean): readonly string[] {
  return Object.freeze(selected ? [...new Set([...values, permission])].sort() : values.filter((value) => value !== permission));
}

function ownerConfirmation(editor: Extract<AccessEditor, { kind: 'owner' }>): string {
  if (editor.action === 'create') return '请确认申请内容；新所有者接受前不会切换权限。';
  if (editor.action === 'accept') return '请确认接受后所有权立即切换，双方权限版本会同时更新。';
  return '请确认取消后本次申请不可再接受。';
}
