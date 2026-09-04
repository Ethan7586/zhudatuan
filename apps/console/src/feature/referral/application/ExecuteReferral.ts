import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { assertOperationAccess } from '../../../shared/security/OperationAccess';
import type { ReferralActionValues } from '../model/Referral';
import { createReferralCommand } from '../model/ReferralOperation';
import type { ReferralPort } from '../public';

export async function executeReferral(port: Pick<ReferralPort, 'execute'>, context: ConsoleContext, values: ReferralActionValues, proof: string, identity: string, signal?: AbortSignal): Promise<void> {
  const command = createReferralCommand(values);
  assertOperationAccess(context, command.operation, proof);
  if (context.session.csrf === undefined) throw new Error('CSRF_TOKEN_INVALID');
  if (!identity) throw new Error('IDEMPOTENCY_KEY_REQUIRED');
  await port.execute(context, command, proof, identity, signal);
}
