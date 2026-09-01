import type { OperationRequest, OperationResult } from '../../../../foundation/application/OperationRequest';
import { bodyRecord } from '../../../../foundation/interface/Validation';
import type { WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
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
  async prepare(request: OperationRequest): Promise<Readonly<{ target: 'console' | 'storefront' }>> {
    try {
      const target = bodyRecord(request.input).target;
      if (target !== 'console' && target !== 'storefront') throw new DomainError('INVITATION_INVALID');
      await this.guard.assert(request, target);
      return Object.freeze({ target });
    } catch (cause) {
      this.failure(request, cause);
      throw cause;
    }
  }

  async execute(request: OperationRequest, database: WriteTransactionContext, prepared: Readonly<{ target: 'console' | 'storefront' }>): Promise<OperationResult> {
    try {
      const invitation = await this.lookup.find(database, bodyRecord(request.input).code, prepared.target);
      await this.guard.assertRecipientWithin(database, request, prepared.target, invitation.state.recipientHash);
      const policy = invitation.state.policy ? await this.registrations.read(database, invitation.state.policy, false) : null;
      this.telemetry.metrics.count('identity_invitation_resolve_total', 1, { ...this.base(request), result: 'success' });
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
      this.failure(request, cause);
      throw cause;
    }
  }

  private base(request: OperationRequest) {
    const trace = request.input.headers['x-trace-id'] ?? request.input.idempotency ?? request.input.publicActor ?? 'public:invitation';
    return { requestId: trace, traceId: trace, module: 'identity', operation: 'identity.invitations.resolve' } as const;
  }

  private failure(request: OperationRequest, cause: unknown): void {
    const errorCode = cause instanceof DomainError ? cause.code : 'INVITATION_RESOLVE_FAILED';
    const base = this.base(request);
    this.telemetry.metrics.count('identity_invitation_resolve_total', 1, { ...base, result: 'failure', errorCode });
    this.telemetry.metrics.count('identity_invitation_failure_total', 1, { ...base, result: 'failure', errorCode });
  }
}
