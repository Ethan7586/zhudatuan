import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { CommitContext, FinalizeContext, HandlerContext, PrepareContext } from '../../../../foundation/application/HandlerContext';
import type { DurableOperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import type { IdentityLifecycle } from '../model/IdentityAction';
import { identityReply, identityRequest, type IdentityLifecycleCheckpoint, type PreparedIdentityLifecycle } from '../model/IdentityExecution';
import type { LoadedFederationCallback, PreparedFederationCallback } from '../service/FederateIdentity';

export class FederationCallbackHandler
  implements DurableOperationHandler<'identity.federations.callback', PreparedIdentityLifecycle<PreparedFederationCallback>, IdentityLifecycleCheckpoint<PreparedFederationCallback>, 'write', LoadedFederationCallback>
{
  readonly operation = 'identity.federations.callback' as const;
  readonly mode = 'write' as const;

  constructor(private readonly lifecycle: IdentityLifecycle<PreparedFederationCallback, LoadedFederationCallback>) {}

  load(input: OperationInputFor<'identity.federations.callback'>, context: HandlerContext<'identity.federations.callback'>): Promise<LoadedFederationCallback> {
    const request = identityRequest(this.operation, input, context);
    if (!this.lifecycle.load) throw new Error('FEDERATION_LOAD_REQUIRED');
    return this.lifecycle.load(request, context.transaction);
  }

  async prepare(input: OperationInputFor<'identity.federations.callback'>, context: PrepareContext<'identity.federations.callback'>, loaded: LoadedFederationCallback): Promise<PreparedIdentityLifecycle<PreparedFederationCallback>> {
    const request = identityRequest(this.operation, input, context);
    if (!this.lifecycle.prepare) throw new Error('FEDERATION_PREPARE_REQUIRED');
    return Object.freeze({ request, preparation: await this.lifecycle.prepare(request, loaded) });
  }

  async commit(_input: OperationInputFor<'identity.federations.callback'>, prepared: PreparedIdentityLifecycle<PreparedFederationCallback>, context: CommitContext<'identity.federations.callback'>) {
    const result = await this.lifecycle.execute(prepared.request, context.transaction, prepared.preparation);
    return Object.freeze({
      checkpoint: Object.freeze({ request: prepared.request, result, preparation: prepared.preparation }),
      response: identityReply<'identity.federations.callback'>(result),
    });
  }

  async finalize(
    _input: OperationInputFor<'identity.federations.callback'>,
    checkpoint: IdentityLifecycleCheckpoint<PreparedFederationCallback>,
    _context: FinalizeContext<'identity.federations.callback'>
  ): Promise<OperationReply<OperationOutputFor<'identity.federations.callback'>>> {
    return identityReply<'identity.federations.callback'>(checkpoint.result);
  }
}
