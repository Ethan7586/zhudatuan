import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { CommitContext, FinalizeContext, HandlerContext, PrepareContext } from '../../../../pipeline/HandlerContext';
import type { DurableOperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import type { IdentityLifecycle } from '../model/IdentityAction';
import { identityReply, identityRequest, type IdentityLifecycleCheckpoint, type PreparedIdentityLifecycle } from '../model/IdentityExecution';
import type { LoadedFederationStart, PreparedFederationStart } from '../service/FederateIdentity';

export class LinksCreateHandler implements DurableOperationHandler<'identity.links.create', PreparedIdentityLifecycle<PreparedFederationStart>, IdentityLifecycleCheckpoint<PreparedFederationStart>, 'write', LoadedFederationStart> {
  readonly operation = 'identity.links.create' as const;
  readonly mode = 'write' as const;

  constructor(private readonly lifecycle: IdentityLifecycle<PreparedFederationStart, LoadedFederationStart>) {}

  load(input: OperationInputFor<'identity.links.create'>, context: HandlerContext<'identity.links.create'>): Promise<LoadedFederationStart> {
    const request = identityRequest(this.operation, input, context);
    if (!this.lifecycle.load) throw new Error('FEDERATION_LOAD_REQUIRED');
    return this.lifecycle.load(request, context.transaction);
  }

  async prepare(input: OperationInputFor<'identity.links.create'>, context: PrepareContext<'identity.links.create'>, loaded: LoadedFederationStart): Promise<PreparedIdentityLifecycle<PreparedFederationStart>> {
    const request = identityRequest(this.operation, input, context);
    if (!this.lifecycle.prepare) throw new Error('FEDERATION_PREPARE_REQUIRED');
    return Object.freeze({ request, preparation: await this.lifecycle.prepare(request, loaded) });
  }

  async commit(_input: OperationInputFor<'identity.links.create'>, prepared: PreparedIdentityLifecycle<PreparedFederationStart>, context: CommitContext<'identity.links.create'>) {
    const result = await this.lifecycle.execute(prepared.request, context.transaction, prepared.preparation);
    return Object.freeze({
      checkpoint: Object.freeze({ request: prepared.request, result, preparation: prepared.preparation }),
      response: identityReply<'identity.links.create'>(result),
    });
  }

  async finalize(
    _input: OperationInputFor<'identity.links.create'>,
    checkpoint: IdentityLifecycleCheckpoint<PreparedFederationStart>,
    _context: FinalizeContext<'identity.links.create'>
  ): Promise<OperationReply<OperationOutputFor<'identity.links.create'>>> {
    return identityReply<'identity.links.create'>(checkpoint.result);
  }
}
