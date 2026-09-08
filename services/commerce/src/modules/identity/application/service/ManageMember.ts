import { IdentityAction as OperationAction } from '../model/IdentityAction';
import { requireWriteTransaction } from '../../../../platform/database/TransactionContext';
import { randomUUID } from 'node:crypto';

import { requireAccess } from '../../../../pipeline/OperationAccess';

import { bodyRecord, textField } from '../../../../pipeline/Validation';
import { DomainError } from '../../../../platform/error/DomainError';
import type { IdentityAccessPort } from '../../../access/public';
import type { IdentityMemberPort } from '../../../member/public';
import type { RegistrationResetRepository } from '../port/RegistrationResetRepository';
import type { IdentityEventRepository } from '../port/IdentityEventRepository';
import { PERM_IDENTITY_REGISTRATION_RESET } from '@shop/authz/ids';

export class ManageMember {
  constructor(
    private readonly access: IdentityAccessPort,
    private readonly members: IdentityMemberPort,
    private readonly registrations: RegistrationResetRepository,
    private readonly events: IdentityEventRepository
  ) {}
  action(): OperationAction {
    return async (request, database) => {
      const actor = requireAccess(request);
      const body = bodyRecord(request.input);
      const action = body.action;
      if (action !== 'update' && action !== 'disable' && action !== 'enable' && action !== 'offboard' && action !== 'registrationReset') throw new DomainError('VALIDATION_FAILED', { field: 'action' });
      const membershipId = request.input.path.membershipid!;
      const reason = textField(body, 'reason', 1000);
      if (reason.trim().length < 4) throw new DomainError('VALIDATION_FAILED', { field: 'reason' });
      if (action === 'registrationReset') await this.registrations.lock(requireWriteTransaction(database), membershipId);
      const target = await this.access.memberForManagement(database, membershipId);
      if (target.accessVersion !== request.input.expectedVersion) throw new DomainError('VERSION_CONFLICT');
      if (action === 'disable' || action === 'enable' || action === 'offboard') {
        const status = action === 'enable' ? 'active' : action === 'offboard' ? 'left' : 'suspended';
        const changed = await this.access.changeStatus(requireWriteTransaction(database), membershipId, status);
        return { status: 200, body: { action, membershipId, status, accessVersion: changed.accessVersion } };
      }
      if (action === 'registrationReset') {
        if (!allows(actor, PERM_IDENTITY_REGISTRATION_RESET)) throw new DomainError('AUTHORIZATION_DENIED');
        const principal = await this.members.registrationPrincipal(database, target.member);
        const resetTarget = await this.registrations.target(requireWriteTransaction(database), principal, actor.actor.id);
        const memberships = await this.access.resetRegistrations(requireWriteTransaction(database), {
          member: target.member,
          actorMembership: actor.membership.id,
          trace: actor.trace,
        });
        const profile = await this.members.releaseRegistration(requireWriteTransaction(database), target.member, principal);
        const reset = await this.registrations.reset(requireWriteTransaction(database), resetTarget, randomUUID());
        if (reset === null) throw new DomainError('VERSION_CONFLICT');
        await this.events.publish(database, 'identity.member.reset', 'principal', principal, actor.scope.id, actor.trace, {
          memberId: target.member,
          credentialVersion: reset.credentialVersion,
          reason: reason.trim(),
        });
        return {
          status: 200,
          body: {
            action,
            memberId: target.member,
            principalId: principal,
            status: 'reset',
            loginIdentityReleased: true,
            historyRetained: true,
            memberships: memberships.memberships,
            accessVersion: memberships.accessVersion,
            profileVersion: profile.version,
            principalVersion: reset.version,
          },
        };
      }
      const result = await this.members.updateDisplay(requireWriteTransaction(database), target.member, textField(body, 'displayName', 128));
      if (typeof body.departmentId === 'string' && body.departmentId.length > 0)
        await this.access.replaceDepartment(requireWriteTransaction(database), { membership: membershipId, department: body.departmentId, path: `${actor.scope.id}/${body.departmentId}`, grant: `scope:${randomUUID()}` });
      return { status: 200, body: { action: 'update', memberId: String(result.id), displayName: String(result.display_name), version: Number(result.version) } };
    };
  }
}

function allows(actor: ReturnType<typeof requireAccess>, permission: string): boolean {
  return actor.membership.permissions.allows.has(permission) && !actor.membership.permissions.denies.has(permission);
}
