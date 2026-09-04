import { OP_PARTNER_PARTNERS_MANAGE } from '@shop/contract/ids';
import type { ConsoleContext } from '../../../../entity/session/ConsoleSession';
import { assertOperationAccess } from '../../../../shared/security/OperationAccess';
import type { PartnerChange } from '../model/Partner';
import type { PartnerPort } from '../public';

export class ManagePartner {
  constructor(private readonly port: Pick<PartnerPort, 'managePartner'>) {}
  execute(context: ConsoleContext, change: PartnerChange, identity: string, signal?: AbortSignal) {
    assertOperationAccess(context, OP_PARTNER_PARTNERS_MANAGE);
    requireCommand(context, identity, change.name);
    return this.port.managePartner(context, change, identity, signal);
  }
}

export function requireCommand(context: ConsoleContext, identity: string, name: string): void {
  if (context.session.csrf === undefined) throw new Error('CSRF_TOKEN_INVALID');
  if (!identity) throw new Error('IDEMPOTENCY_KEY_REQUIRED');
  if (name.trim().length < 2 || name.trim().length > 160) throw new Error('VALIDATION_FAILED');
}
