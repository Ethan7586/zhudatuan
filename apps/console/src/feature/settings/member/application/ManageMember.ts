import { OP_IDENTITY_MEMBERS_MANAGE } from '@shop/contract/ids';
import type { ConsoleContext } from '../../../../entity/session/ConsoleSession';
import { assertOperationAccess } from '../../../../shared/security/OperationAccess';
import type { MemberChange } from '../model/Member';
import type { MemberPort } from '../public';

export class ManageMember {
  constructor(private readonly port: Pick<MemberPort, 'manage'>) {}
  execute(context: ConsoleContext, change: MemberChange, identity: string, signal?: AbortSignal) {
    assertOperationAccess(context, OP_IDENTITY_MEMBERS_MANAGE);
    if (context.session.csrf === undefined) throw new Error('CSRF_TOKEN_INVALID');
    if (!identity) throw new Error('IDEMPOTENCY_KEY_REQUIRED');
    if (change.reason.trim().length < 4 || change.reason.trim().length > 1000) throw new Error('VALIDATION_FAILED');
    return this.port.manage(context, change, identity, signal);
  }
}
