import { randomUUID } from 'node:crypto';
import type { OperationAction } from '../../../../foundation/application/ModuleOperations';
import { requireAccess } from '../../../../foundation/application/ModuleOperations';
import { bodyRecord, textField } from '../../../../foundation/interface/Validation';
import { DomainError } from '../../../../foundation/domain/DomainError';
import type { IdentityAccessPort } from '../../../access/public';
import type { IdentityMemberPort } from '../../../member/public';

export class ManageMember {
  constructor(
    private readonly access: IdentityAccessPort,
    private readonly members: IdentityMemberPort
  ) {}
  action(): OperationAction {
    return async (request, database) => {
      const actor = requireAccess(request);
      const body = bodyRecord(request);
      const action = body.action;
      if (action !== 'update' && action !== 'status') throw new DomainError('VALIDATION_FAILED', { field: 'action' });
      const membershipId = request.input.path.membershipid!;
      const reason = textField(body, 'reason', 1000);
      if (reason.trim().length < 4) throw new DomainError('VALIDATION_FAILED', { field: 'reason' });
      const target = await this.access.memberForManagement(database, membershipId);
      if (target.accessVersion !== request.input.expectedVersion) throw new DomainError('VERSION_CONFLICT');
      if (action === 'status') {
        const status = body.status === 'offboarded' ? 'left' : body.status;
        if (status !== 'active' && status !== 'suspended' && status !== 'left') throw new DomainError('VALIDATION_FAILED', { field: 'status' });
        const changed = await this.access.changeStatus(database, membershipId, status);
        return { status: 200, body: { action: 'status', membershipId, status, accessVersion: changed.accessVersion } };
      }
      const result = await this.members.updateDisplay(database, target.member, textField(body, 'displayName', 128));
      if (typeof body.departmentId === 'string' && body.departmentId.length > 0)
        await this.access.replaceDepartment(database, { membership: membershipId, department: body.departmentId, path: `${actor.scope.id}/${body.departmentId}`, grant: `scope:${randomUUID()}` });
      return { status: 200, body: { action: 'update', memberId: String(result.id), displayName: String(result.display_name), version: Number(result.version) } };
    };
  }
}
