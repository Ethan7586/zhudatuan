import type { AccessPage, AccessRole, Ownership } from './Access';
import type { AccessEditor } from './AccessEditor';

export interface AccessConflict {
  readonly title: string;
  readonly details: readonly string[];
  readonly next?: AccessEditor;
}

export function accessConflict(editor: AccessEditor, page: AccessPage | undefined, ownership: Ownership | undefined): AccessConflict {
  const next = rebaseEditor(editor, page, ownership);
  return Object.freeze({
    title: next === undefined ? '目标已被删除或不再可操作' : '权威版本已变化，旧复核凭证已作废',
    details: Object.freeze(conflictDetails(editor, next)),
    ...(next === undefined ? {} : { next }),
  });
}

function rebaseEditor(editor: AccessEditor, page: AccessPage | undefined, ownership: Ownership | undefined): AccessEditor | undefined {
  if (editor.kind === 'role') return rebaseRole(editor, page);
  if (editor.kind === 'override' || editor.kind === 'scope') {
    const membership = page?.items.find((item) => item.id === editor.membership.id);
    return membership === undefined ? undefined : Object.freeze({ ...editor, membership, proof: '', confirmed: false });
  }
  if (ownership === undefined) return undefined;
  const transfer = editor.action === 'create' ? null : ownership.pending;
  if (editor.action !== 'create' && transfer === null) return undefined;
  const rebased = { ...editor, ownership, transfer, targetId: editor.action === 'create' ? editor.targetId : transfer?.targetMembership ?? '', proof: '', confirmed: false };
  Reflect.deleteProperty(rebased, 'preview');
  return Object.freeze(rebased);
}

function rebaseRole(editor: Extract<AccessEditor, { kind: 'role' }>, page: AccessPage | undefined): AccessEditor | undefined {
  const role = page?.roles.find((item) => item.id === editor.role.id);
  if (role === undefined) return undefined;
  if (editor.action === 'save') return Object.freeze({ ...editor, role, proof: '', confirmed: false });
  if (editor.action === 'assign' || editor.action === 'revoke') {
    const membership = page?.items.find((item) => item.id === editor.membership.id);
    return membership === undefined ? undefined : Object.freeze({ ...editor, role, membership, proof: '', confirmed: false });
  }
  return Object.freeze({ ...editor, role, proof: '', confirmed: false });
}

function conflictDetails(previous: AccessEditor, next: AccessEditor | undefined): string[] {
  if (next === undefined) return ['重新加载后未找到原目标；系统不会对其他对象执行操作。'];
  if (previous.kind === 'role' && next.kind === 'role') return roleDetails(previous.role, next.role);
  if ((previous.kind === 'override' || previous.kind === 'scope') && (next.kind === 'override' || next.kind === 'scope')) {
    return [
      `成员权限版本：第 ${previous.membership.accessVersion} 版 → 第 ${next.membership.accessVersion} 版`,
      `角色数量：${previous.membership.roles.length} → ${next.membership.roles.length}`,
      `项目范围：${previous.membership.scopes.length} → ${next.membership.scopes.length}`,
      `覆盖权限：${previous.membership.overrides.length} → ${next.membership.overrides.length}`,
    ];
  }
  if (previous.kind === 'owner' && next.kind === 'owner') {
    return [
      `所有权版本：第 ${previous.ownership.version} 版 → 第 ${next.ownership.version} 版`,
      `当前所有者：${previous.ownership.owner.displayName} → ${next.ownership.owner.displayName}`,
      `待接受申请：${previous.ownership.pending?.targetDisplayName ?? '无'} → ${next.ownership.pending?.targetDisplayName ?? '无'}`,
    ];
  }
  return ['目标类型已变化，请重新加载后复核。'];
}

function roleDetails(previous: AccessRole, next: AccessRole): string[] {
  const details = [`角色版本：第 ${previous.version} 版 → 第 ${next.version} 版`];
  if (previous.name !== next.name) details.push(`角色名称：${previous.name} → ${next.name}`);
  if (previous.status !== next.status) details.push(`角色状态：${previous.status} → ${next.status}`);
  if (previous.allows.join('\n') !== next.allows.join('\n')) details.push(`允许权限：${previous.allows.length} 项 → ${next.allows.length} 项`);
  if (previous.denies.join('\n') !== next.denies.join('\n')) details.push(`明确拒绝：${previous.denies.length} 项 → ${next.denies.length} 项`);
  return details;
}
