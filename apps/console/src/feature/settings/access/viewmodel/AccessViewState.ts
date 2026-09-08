import { OP_ACCESS_CENTER_READ, OP_ACCESS_OWNERSHIP_READ, OP_ORGANIZATION_LAYERS_READ } from '@shop/contract/ids';
import type { ConsoleContext } from '../../../../entity/session/ConsoleSession';
import type { AccessReceipt, AccessRole, RoleTemplateCode } from '../model/Access';
import type { AccessEditor } from '../model/AccessEditor';

export interface AccessApproval {
  readonly request: string;
  readonly busy: boolean;
  readonly error?: string;
}

export interface AccessViewReceipt extends AccessReceipt {
  readonly requestId: string;
  readonly occurredAt: string;
}

export type AccessTask = 'members' | 'roles' | 'scopes' | 'ownership';

interface StoredRoleDraft {
  readonly name: string;
  readonly description: string;
  readonly template: RoleTemplateCode;
  readonly allows: readonly string[];
  readonly denies: readonly string[];
  readonly step: 1 | 2 | 3;
}

export function emptyRole(id: string): AccessRole {
  return Object.freeze({ id: `role:${id}`, name: '', description: '', status: 'active', kind: 'custom', template: null, version: 0, allows: Object.freeze([]), denies: Object.freeze([]), affectedPeople: 0, affectedScopes: 0, members: Object.freeze([]) });
}

function roleDraftKey(scope: string): string {
  return `zhudatuan:access:roledraft:${scope}`;
}

export function saveRoleDraft(scope: string, editor: Extract<AccessEditor, { kind: 'role'; action: 'save' }>): void {
  try {
    const draft: StoredRoleDraft = { name: editor.name, description: editor.description, template: editor.template, allows: editor.allows, denies: editor.denies, step: editor.step };
    window.localStorage.setItem(roleDraftKey(scope), JSON.stringify(draft));
  } catch {
    // Storage denial must not block the formal server-side save path.
  }
}

export function loadRoleDraft(scope: string): StoredRoleDraft | undefined {
  try {
    const raw = window.localStorage.getItem(roleDraftKey(scope));
    if (!raw) return undefined;
    const value = JSON.parse(raw) as Partial<StoredRoleDraft>;
    const templates: readonly string[] = ['malloperator', 'catalogoperator', 'ordersupport', 'financeoperator', 'financereviewer', 'administrator', 'custom'];
    if (typeof value.name !== 'string' || typeof value.description !== 'string' || !templates.includes(value.template ?? '') || !Array.isArray(value.allows) || !Array.isArray(value.denies) || (value.step !== 1 && value.step !== 2 && value.step !== 3)) return undefined;
    return value as StoredRoleDraft;
  } catch {
    return undefined;
  }
}

export function clearRoleDraft(scope: string): void {
  try {
    window.localStorage.removeItem(roleDraftKey(scope));
  } catch {
    // A completed authoritative write remains successful even if local cleanup is denied.
  }
}

export function accessQueryKey(context: ConsoleContext, cursor?: string) {
  return Object.freeze(['console', context.scope.kind, context.scope.id, context.session.accessVersion, OP_ACCESS_CENTER_READ, cursor ?? null, 50] as const);
}

export function ownershipQueryKey(context: ConsoleContext) {
  return Object.freeze(['console', context.scope.kind, context.scope.id, context.session.accessVersion, OP_ACCESS_OWNERSHIP_READ] as const);
}

export function scopeQueryKey(context: ConsoleContext) {
  return Object.freeze(['console', context.scope.kind, context.scope.id, context.session.accessVersion, OP_ORGANIZATION_LAYERS_READ, 'access'] as const);
}

export function resetOwnerPreview(editor: Extract<AccessEditor, { kind: 'owner' }>): Extract<AccessEditor, { kind: 'owner' }> {
  const next = { ...editor };
  Reflect.deleteProperty(next, 'preview');
  return next;
}
