import type { AccessChange, AccessEffect, AccessMembership, AccessRole, AccessScopeKind } from './Access';

interface EditorBase {
  readonly proof: string;
  readonly confirmed: boolean;
}
export type AccessEditor =
  | (EditorBase & Readonly<{ kind: 'role'; membership: AccessMembership; role: AccessRole; name: string; allows: readonly string[]; denies: readonly string[] }>)
  | (EditorBase & Readonly<{ kind: 'override'; membership: AccessMembership; action: 'set' | 'revoke'; permission: string; effect: AccessEffect; expiresAt: string; reason: string }>)
  | (EditorBase & Readonly<{ kind: 'scope'; membership: AccessMembership; scopeKind: AccessScopeKind; resource: string; effect: AccessEffect; expiresAt: string }>)
  | (EditorBase & Readonly<{ kind: 'owner'; membership: AccessMembership; targetId: string; reason: string }>);

export function buildAccessChange(editor: AccessEditor, targets: readonly AccessMembership[]): AccessChange | undefined {
  if (editor.kind === 'role') return Object.freeze({ kind: 'role', membership: editor.membership, role: editor.role, name: editor.name, allows: editor.allows, denies: editor.denies });
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
  const target = targets.find((item) => item.id === editor.targetId);
  return target === undefined ? undefined : Object.freeze({ kind: 'owner', membership: editor.membership, target, reason: editor.reason.trim() });
}

export function validateAccessChange(editor: AccessEditor | undefined, change: AccessChange | undefined, assurance: number): string | undefined {
  if (editor === undefined) return undefined;
  const body = validateAccessBody(editor, change);
  if (body) return body;
  if (assurance < 3) return '请先完成高强度二次验证。';
  if (!editor.confirmed) return editor.kind === 'owner' ? '请确认所有权转移会立即变更双方权限。' : '请确认目标、版本与修改内容。';
  if (!/^[A-Za-z0-9_-]{43,128}$/.test(editor.proof)) return '请输入另一位管理员签发的一次性操作凭证。';
  return undefined;
}

export function validateAccessBody(editor: AccessEditor | undefined, change: AccessChange | undefined): string | undefined {
  if (editor === undefined || change === undefined) return '请选择有效目标。';
  if (change.kind === 'role' && (change.name.trim().length === 0 || change.name.trim().length > 120)) return '角色名称需为 1 至 120 个字符。';
  if (change.kind === 'override' && (change.permission.length === 0 || change.reason.length < 4 || change.reason.length > 500)) return '请选择权限并填写 4 至 500 字的审计原因。';
  if (change.kind === 'scope' && change.resource.length === 0) return '请输入有效的项目或资源标识。';
  if (change.kind === 'owner' && (change.reason.length < 4 || change.reason.length > 500)) return '请填写 4 至 500 字的所有权转移原因。';
  return undefined;
}

export function selectPermission(values: readonly string[], permission: string, selected: boolean): readonly string[] {
  return Object.freeze(selected ? [...new Set([...values, permission])].sort() : values.filter((value) => value !== permission));
}
