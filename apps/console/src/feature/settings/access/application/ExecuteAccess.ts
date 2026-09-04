import type { ConsoleContext } from '../../../../entity/session/ConsoleSession';
import { assertOperationAccess } from '../../../../shared/security/OperationAccess';
import { accessEnvelope, type AccessChange } from '../model/Access';
import type { AccessPort } from '../public';

export async function executeAccess(port: Pick<AccessPort, 'execute'>, context: ConsoleContext, change: AccessChange, proof: string, identity: string, signal?: AbortSignal) {
  assertOperationAccess(context, accessEnvelope(change).operation, proof);
  if (context.session.csrf === undefined) throw new Error('CSRF_TOKEN_INVALID');
  if (!identity) throw new Error('IDEMPOTENCY_KEY_REQUIRED');
  return port.execute(context, change, proof, identity, signal);
}
