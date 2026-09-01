import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { CommitContext, FinalizeContext, HandlerContext, PrepareContext } from '../../../../foundation/application/HandlerContext';
import type { DurableOperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import type { OperationResult } from '../../../../foundation/application/OperationRequest';
import type { IdentityLifecycle } from '../model/IdentityAction';
import { identityReply, identityRequest } from '../model/IdentityExecution';

export class ProvidersTestHandler implements DurableOperationHandler<'identity.providers.test', OperationResult, OperationResult, 'write', unknown> {
  readonly operation = 'identity.providers.test' as const;
  readonly mode = 'write' as const;

  constructor(private readonly lifecycle: IdentityLifecycle<OperationResult, unknown>) {}

  load(input: OperationInputFor<'identity.providers.test'>, context: HandlerContext<'identity.providers.test'>): Promise<unknown> {
    const request = identityRequest(this.operation, input, context);
    if (!this.lifecycle.load) throw new Error('PROVIDER_LOAD_REQUIRED');
    return this.lifecycle.load(request, context.transaction);
  }

  async prepare(input: OperationInputFor<'identity.providers.test'>, context: PrepareContext<'identity.providers.test'>, loaded: unknown): Promise<OperationResult> {
    const request = identityRequest(this.operation, input, context);
    if (!this.lifecycle.prepare) throw new Error('PROVIDER_PREPARE_REQUIRED');
    return this.lifecycle.prepare(request, loaded);
  }

  async commit(_input: OperationInputFor<'identity.providers.test'>, prepared: OperationResult, _context: CommitContext<'identity.providers.test'>) {
    return Object.freeze({ checkpoint: prepared, response: identityReply<'identity.providers.test'>(prepared) });
  }

  async finalize(_input: OperationInputFor<'identity.providers.test'>, checkpoint: OperationResult, _context: FinalizeContext<'identity.providers.test'>): Promise<OperationReply<OperationOutputFor<'identity.providers.test'>>> {
    return identityReply<'identity.providers.test'>(checkpoint);
  }
}
