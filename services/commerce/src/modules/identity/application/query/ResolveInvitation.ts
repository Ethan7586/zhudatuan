import type { OperationAction } from '../../../../foundation/application/ModuleOperations';
import { bodyRecord } from '../../../../foundation/interface/Validation';
import type { InvitationGuard } from '../service/InvitationGuard';
import { DomainError } from '../../../../foundation/domain/DomainError';
import type { Telemetry } from '@shop/telemetry';
import type { RegistrationPolicyRepository } from '../port/RegistrationPolicyRepository';
import type { InvitationLookup } from '../service/InvitationLookup';
import { registrationPolicyView } from './RegistrationPolicyView';

export class ResolveInvitation {
  constructor(
    private readonly lookup: InvitationLookup,
    private readonly guard: InvitationGuard,
    private readonly telemetry: Telemetry,
    private readonly registrations: RegistrationPolicyRepository
  ) {}
  action(): OperationAction {
    return async (request, database) => {
      const trace = request.input.headers['x-trace-id'] ?? request.input.idempotency ?? request.input.publicActor ?? 'public:invitation';
      const base = { requestId: trace, traceId: trace, module: 'identity', operation: 'identity.invitations.resolve' };
      try {
        const body = bodyRecord(request);
        const target = body.target;
        if (target !== 'console' && target !== 'storefront') throw new DomainError('INVITATION_INVALID');
        await this.guard.assert(request, target);
        const invitation = await this.lookup.find(database, body.code, target, false);
        await this.guard.assertRecipient(request, target, invitation.state.recipientHash);
        const policy = invitation.state.policy ? await this.registrations.read(database, invitation.state.policy, false) : null;
        this.telemetry.metrics.count('identity_invitation_resolve_total', 1, { ...base, result: 'success' });
        return {
          status: 200,
          body: {
            kind: invitation.state.kind,
            target: invitation.state.target,
            expiresAt: invitation.state.expiresAt.toISOString(),
            requiresProof: invitation.requiresProof(),
            requiresEnrollment: invitation.requiresEnrollment(),
            ...(policy ? { policy: registrationPolicyView(policy) } : {}),
          },
        };
      } catch (cause) {
        const errorCode = cause instanceof DomainError ? cause.code : 'INVITATION_RESOLVE_FAILED';
        this.telemetry.metrics.count('identity_invitation_resolve_total', 1, { ...base, result: 'failure', errorCode });
        this.telemetry.metrics.count('identity_invitation_failure_total', 1, { ...base, result: 'failure', errorCode });
        throw cause;
      }
    };
  }
}
