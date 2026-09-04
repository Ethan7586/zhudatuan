import type { OperationId } from '@shop/contract';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { assertOperationAccess } from '../../../shared/security/OperationAccess';

export function assertApprovalCommand(context: ConsoleContext, operation: OperationId, identity: string): void {
  assertOperationAccess(context, operation);
  if (context.session.csrf === undefined) throw new Error('CSRF_TOKEN_INVALID');
  if (!identity) throw new Error('IDEMPOTENCY_KEY_REQUIRED');
}
