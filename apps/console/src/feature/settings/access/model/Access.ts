import {
  OP_ACCESS_OVERRIDES_MANAGE,
  OP_ACCESS_OWNERSHIP_TRANSFERS_ACCEPT,
  OP_ACCESS_OWNERSHIP_TRANSFERS_ACCEPT_PREVIEW,
  OP_ACCESS_OWNERSHIP_TRANSFERS_CANCEL,
  OP_ACCESS_OWNERSHIP_TRANSFERS_CANCEL_PREVIEW,
  OP_ACCESS_OWNERSHIP_TRANSFERS_CREATE,
  OP_ACCESS_OWNERSHIP_TRANSFERS_PREVIEW,
  OP_ACCESS_ROLES_MANAGE,
  OP_ACCESS_SCOPES_MANAGE,
} from '@shop/contract/ids';
import type { AccessChange, AccessEnvelope, OwnerChange } from './AccessState';

export * from './AccessState';

export function accessEnvelope(change: AccessChange): AccessEnvelope {
  if (change.kind === 'role')
    return Object.freeze({
      operation: OP_ACCESS_ROLES_MANAGE,
      input: Object.freeze({
        path: Object.freeze({ roleid: change.role.id }),
        body: Object.freeze(
          change.action === 'save'
            ? { action: 'save' as const, name: change.name.trim(), description: change.description.trim(), template: change.template, allows: [...change.allows], denies: [...change.denies] }
            : change.action === 'status'
              ? { action: 'status' as const, status: change.status }
              : change.action === 'assign' || change.action === 'revoke'
                ? { action: change.action, targetMembership: change.membership.id }
                : { action: 'delete' as const }
        ),
      }),
      expectedVersion: change.action === 'assign' || change.action === 'revoke' ? change.membership.accessVersion : change.role.version,
    });
  if (change.kind === 'override') {
    const body =
      change.action === 'revoke'
        ? { action: 'revoke' as const, targetMembership: change.membership.id, permission: change.permission, reason: change.reason.trim() }
        : { action: 'set' as const, targetMembership: change.membership.id, permission: change.permission, effect: change.effect, ...(change.expiresAt ? { expiresAt: change.expiresAt } : {}), reason: change.reason.trim() };
    return Object.freeze({ operation: OP_ACCESS_OVERRIDES_MANAGE, input: Object.freeze({ body: Object.freeze(body) }), expectedVersion: change.membership.accessVersion });
  }
  if (change.kind === 'scope')
    return Object.freeze({
      operation: OP_ACCESS_SCOPES_MANAGE,
      input: Object.freeze({ body: Object.freeze({ targetMembership: change.membership.id, kind: change.scopeKind, scope: change.resource.trim(), effect: change.effect, ...(change.expiresAt ? { expiresAt: change.expiresAt } : {}) }) }),
      expectedVersion: change.membership.accessVersion,
    });
  if (change.action === 'create') {
    const body = {
      targetMembership: change.target.membership,
      targetAccessVersion: change.target.accessVersion,
      formerOwnerMode: change.formerOwnerMode,
      ...(change.formerOwnerRole === null ? {} : { formerOwnerRole: change.formerOwnerRole }),
      reason: change.reason.trim(),
    };
    return Object.freeze({ operation: OP_ACCESS_OWNERSHIP_TRANSFERS_CREATE, input: Object.freeze({ body: Object.freeze(body) }), expectedVersion: change.ownership.version });
  }
  if (change.action === 'accept') {
    return Object.freeze({
      operation: OP_ACCESS_OWNERSHIP_TRANSFERS_ACCEPT,
      input: Object.freeze({ path: Object.freeze({ transferid: change.transfer.id }), body: Object.freeze({}) }),
      expectedVersion: change.transfer.version,
    });
  }
  return Object.freeze({
    operation: OP_ACCESS_OWNERSHIP_TRANSFERS_CANCEL,
    input: Object.freeze({ path: Object.freeze({ transferid: change.transfer.id }), body: Object.freeze({ reason: change.reason.trim() }) }),
    expectedVersion: change.transfer.version,
  });
}

export function ownershipPreviewEnvelope(change: OwnerChange): AccessEnvelope {
  const envelope = accessEnvelope(change);
  if (change.action === 'create') return Object.freeze({ ...envelope, operation: OP_ACCESS_OWNERSHIP_TRANSFERS_PREVIEW });
  if (change.action === 'accept') return Object.freeze({ ...envelope, operation: OP_ACCESS_OWNERSHIP_TRANSFERS_ACCEPT_PREVIEW });
  return Object.freeze({ ...envelope, operation: OP_ACCESS_OWNERSHIP_TRANSFERS_CANCEL_PREVIEW });
}
