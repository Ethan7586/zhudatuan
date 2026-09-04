import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { CommitContext, FinalizeContext, HandlerContext, PrepareContext } from '../../../../foundation/application/HandlerContext';
import type { DurableOperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import type { IdentityLifecycle } from '../model/IdentityAction';
import { identityReply, identityRequest, type IdentityLifecycleCheckpoint, type PreparedIdentityLifecycle } from '../model/IdentityExecution';
import type { LoadedFederationStart, PreparedFederationStart } from '../service/FederateIdentity';

export class FederationStartHandler implements DurableOperationHandler<'identity.federations.start', PreparedIdentityLifecycle<PreparedFederationStart>, IdentityLifecycleCheckpoint<PreparedFederationStart>, 'write', LoadedFederationStart> {
  readonly operation = 'identity.federations.start' as const;
  readonly mode = 'write' as const;

  constructor(private readonly lifecycle: IdentityLifecycle<PreparedFederationStart, LoadedFederationStart>) {}

  load(input: OperationInputFor<'identity.federations.start'>, context: HandlerContext<'identity.federations.start'>): Promise<LoadedFederationStart> {
    const request = identityRequest(this.operation, input, context);
    if (!this.lifecycle.load) throw new Error('FEDERATION_LOAD_REQUIRED');
    return this.lifecycle.load(request, context.transaction);
  }

  async prepare(input: OperationInputFor<'identity.federations.start'>, context: PrepareContext<'identity.federations.start'>, loaded: LoadedFederationStart): Promise<PreparedIdentityLifecycle<PreparedFederationStart>> {
    const request = identityRequest(this.operation, input, context);
    if (!this.lifecycle.prepare) throw new Error('FEDERATION_PREPARE_REQUIRED');
    return Object.freeze({ request, preparation: await this.lifecycle.prepare(request, loaded) });
  }

  async commit(_input: OperationInputFor<'identity.federations.start'>, prepared: PreparedIdentityLifecycle<PreparedFederationStart>, context: CommitContext<'identity.federations.start'>) {
    const result = await this.lifecycle.execute(prepared.request, context.transaction, prepared.preparation);
    return Object.freeze({
      checkpoint: Object.freeze({ request: prepared.request, result, preparation: prepared.preparation }),
      response: identityReply<'identity.federations.start'>(result),
    });
  }

  async finalize(
    _input: OperationInputFor<'identity.federations.start'>,
    checkpoint: IdentityLifecycleCheckpoint<PreparedFederationStart>,
    _context: FinalizeContext<'identity.federations.start'>
  ): Promise<OperationReply<OperationOutputFor<'identity.federations.start'>>> {
    return identityReply<'identity.federations.start'>(checkpoint.result);
  }
}
