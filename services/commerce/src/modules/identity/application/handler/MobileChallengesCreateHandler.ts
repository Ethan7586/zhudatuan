import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { CommitContext, FinalizeContext, HandlerContext, PrepareContext } from '../../../../pipeline/HandlerContext';
import type { DurableOperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import type { IdentityLifecycle } from '../model/IdentityAction';
import { identityReply, identityRequest, type IdentityLifecycleCheckpoint, type PreparedIdentityLifecycle } from '../model/IdentityExecution';

export class MobileChallengesCreateHandler implements DurableOperationHandler<'identity.mobile.challenges.create', PreparedIdentityLifecycle<unknown>, IdentityLifecycleCheckpoint<unknown>, 'write', unknown> {
  readonly operation = 'identity.mobile.challenges.create' as const;
  readonly mode = 'write' as const;

  constructor(private readonly lifecycle: IdentityLifecycle<unknown, unknown>) {}

  load(input: OperationInputFor<'identity.mobile.challenges.create'>, context: HandlerContext<'identity.mobile.challenges.create'>): Promise<unknown> {
    const request = identityRequest(this.operation, input, context);
    return this.lifecycle.load ? this.lifecycle.load(request, context.transaction) : Promise.resolve(undefined);
  }

  async prepare(input: OperationInputFor<'identity.mobile.challenges.create'>, context: PrepareContext<'identity.mobile.challenges.create'>, loaded: unknown): Promise<PreparedIdentityLifecycle<unknown>> {
    const request = identityRequest(this.operation, input, context);
    const preparation = this.lifecycle.prepare ? await this.lifecycle.prepare(request, loaded) : loaded;
    return Object.freeze({ request, preparation });
  }

  async commit(_input: OperationInputFor<'identity.mobile.challenges.create'>, prepared: PreparedIdentityLifecycle<unknown>, context: CommitContext<'identity.mobile.challenges.create'>) {
    const result = await this.lifecycle.execute(prepared.request, context.transaction, prepared.preparation);
    return Object.freeze({
      checkpoint: Object.freeze({ request: prepared.request, result, preparation: prepared.preparation }),
      response: identityReply<'identity.mobile.challenges.create'>(result),
    });
  }

  async finalize(
    _input: OperationInputFor<'identity.mobile.challenges.create'>,
    checkpoint: IdentityLifecycleCheckpoint<unknown>,
    _context: FinalizeContext<'identity.mobile.challenges.create'>
  ): Promise<OperationReply<OperationOutputFor<'identity.mobile.challenges.create'>>> {
    const result = this.lifecycle.finalize ? await this.lifecycle.finalize(checkpoint.request, checkpoint.result, checkpoint.preparation) : checkpoint.result;
    return identityReply<'identity.mobile.challenges.create'>(result);
  }

  discard(prepared: PreparedIdentityLifecycle<unknown>, cause: unknown): Promise<void> {
    return this.lifecycle.discard?.(prepared.request, prepared.preparation, cause) ?? Promise.resolve();
  }
}
