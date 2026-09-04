import type { ConsoleContext } from '../../../../entity/session/ConsoleSession';
import { ownershipPreviewEnvelope, type AccessChange } from '../model/Access';
import type { AccessPort } from '../public';
import { assertOperationAccess } from '../../../../shared/security/OperationAccess';
import { executeAccess } from './ExecuteAccess';

export class TransferOwner {
  constructor(private readonly port: Pick<AccessPort, 'execute' | 'previewOwnership'>) {}
  preview(context: ConsoleContext, change: Extract<AccessChange, { kind: 'owner' }>, identity: string, signal?: AbortSignal) {
    assertOwnerChange(context, change);
    assertOperationAccess(context, ownershipPreviewEnvelope(change).operation);
    if (context.session.csrf === undefined) throw new Error('CSRF_TOKEN_INVALID');
    if (!identity) throw new Error('IDEMPOTENCY_KEY_REQUIRED');
    return this.port.previewOwnership(context, change, identity, signal);
  }
  execute(context: ConsoleContext, change: Extract<AccessChange, { kind: 'owner' }>, proof: string, identity: string, signal?: AbortSignal) {
    assertOwnerChange(context, change);
    return executeAccess(this.port, context, change, proof, identity, signal);
  }
}

function assertOwnerChange(context: ConsoleContext, change: Extract<AccessChange, { kind: 'owner' }>): void {
  if (change.action === 'create') {
    if (change.ownership.owner.membership !== context.session.membership || change.target.membership === context.session.membership) throw new Error('OWNER_TRANSFER_REQUIRED');
    return;
  }
  if (change.ownership.owner.membership !== change.transfer.sourceMembership) throw new Error('OWNER_TRANSFER_REQUIRED');
  if (change.action === 'accept' && change.transfer.targetMembership !== context.session.membership) throw new Error('OWNER_TRANSFER_REQUIRED');
  if (change.action === 'cancel' && change.transfer.sourceMembership !== context.session.membership) throw new Error('OWNER_TRANSFER_REQUIRED');
}
