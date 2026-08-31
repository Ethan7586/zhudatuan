import type { ErrorCode } from '@shop/contract';
import { OperationRejection, reject, type OperationDatabase } from '../../../../foundation/application/ModuleOperations';
import { ApplicationError } from '../../../../foundation/domain/ApplicationError';
import type { OperationRequest } from '../../../../foundation/application/OperationExecution';
import type { IdentityEventPort } from '../port/IdentityEventPort';

export class InvitationFailure {
  constructor(private readonly events: IdentityEventPort) {}

  async record(database: OperationDatabase, request: OperationRequest, invitation: string, scope: string, cause: unknown): Promise<void> {
    const reason = failureCode(cause);
    const trace = request.input.headers['x-trace-id'] ?? request.input.idempotency ?? request.input.publicActor ?? 'public:invitation';
    await this.events.publish(database, 'identity.invitation.failed', 'invitation', invitation, scope, trace, { invitationId: invitation, operation: request.type, reason });
  }

  async reject(database: OperationDatabase, request: OperationRequest, invitation: string, scope: string, cause: unknown, publicCode: ErrorCode): Promise<never> {
    await this.record(database, request, invitation, scope, cause);
    reject(publicCode);
  }
}

function failureCode(cause: unknown): string {
  if (cause instanceof OperationRejection || cause instanceof ApplicationError) return cause.code;
  return 'INVITATION_FLOW_FAILED';
}
