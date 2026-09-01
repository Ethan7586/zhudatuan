import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { FinalizeContext, HandlerContext, PrepareContext } from '../../../../foundation/application/HandlerContext';
import type { DurableOperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import type { OperationResult } from '../../../../foundation/application/OperationRequest';
import type { IdentityLifecycle } from '../model/IdentityAction';
import { identityReply, identityRequest } from '../model/IdentityExecution';

export class SessionReadHandler implements DurableOperationHandler<'identity.session.read', OperationResult, OperationResult, 'read', unknown> {
  readonly operation = 'identity.session.read' as const;
  readonly mode = 'read' as const;

  constructor(private readonly lifecycle: IdentityLifecycle<OperationResult, unknown, 'read'>) {}

  load(input: OperationInputFor<'identity.session.read'>, context: HandlerContext<'identity.session.read'>): Promise<unknown> {
    const request = identityRequest(this.operation, input, context);
    if (!this.lifecycle.load) throw new Error('SESSION_LOAD_REQUIRED');
    return this.lifecycle.load(request, context.transaction);
  }

  async prepare(input: OperationInputFor<'identity.session.read'>, context: PrepareContext<'identity.session.read'>, loaded: unknown): Promise<OperationResult> {
    const request = identityRequest(this.operation, input, context);
    if (!this.lifecycle.prepare) throw new Error('SESSION_PREPARE_REQUIRED');
    return this.lifecycle.prepare(request, loaded);
  }

  async commit(_input: OperationInputFor<'identity.session.read'>, prepared: OperationResult) {
    return Object.freeze({ checkpoint: prepared, response: identityReply<'identity.session.read'>(prepared) });
  }

  async finalize(_input: OperationInputFor<'identity.session.read'>, checkpoint: OperationResult, _context: FinalizeContext<'identity.session.read'>): Promise<OperationReply<OperationOutputFor<'identity.session.read'>>> {
    return identityReply<'identity.session.read'>(checkpoint);
  }
}
