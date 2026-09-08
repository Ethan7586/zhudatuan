import type { ReadTransactionContext } from '../../../../platform/database/TransactionContext';
import type { ApiErrorCode } from '@shop/contract';
import { OperationRejection, reject } from '../../../../pipeline/OperationRejection';

import { ApplicationError } from '../../../../platform/error/ApplicationError';
import type { OperationRequest } from '../../../../pipeline/OperationRequest';
import type { IdentityEventRepository } from '../port/IdentityEventRepository';

export class InvitationFailure {
  constructor(private readonly events: IdentityEventRepository) {}

  async record(database: ReadTransactionContext, request: OperationRequest, invitation: string, scope: string, cause: unknown): Promise<void> {
    const reason = failureCode(cause);
    const trace = request.input.headers['x-trace-id'] ?? request.input.idempotency ?? request.input.publicActor ?? 'public:invitation';
    await this.events.publish(database, 'identity.invitation.failed', 'invitation', invitation, scope, trace, { invitationId: invitation, operation: request.type, reason });
  }

  async reject(database: ReadTransactionContext, request: OperationRequest, invitation: string, scope: string, cause: unknown, publicCode: ApiErrorCode): Promise<never> {
    await this.record(database, request, invitation, scope, cause);
    reject(publicCode);
  }
}

function failureCode(cause: unknown): string {
  if (cause instanceof OperationRejection || cause instanceof ApplicationError) return cause.code;
  return 'INVITATION_FLOW_FAILED';
}
