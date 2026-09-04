import type { OperationId } from '@shop/contract';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { assertOperationAccess } from '../../../shared/security/OperationAccess';

export function assertCommandAccess(context: ConsoleContext, operation: OperationId, identity: string, proof?: string): void {
  assertOperationAccess(context, operation, proof);
  if (!context.session.csrf) throw new Error('CSRF_TOKEN_INVALID');
  if (!identity) throw new Error('IDEMPOTENCY_KEY_REQUIRED');
}
