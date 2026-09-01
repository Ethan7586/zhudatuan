import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { CommitContext, FinalizeContext, HandlerContext, PrepareContext } from '../../../../foundation/application/HandlerContext';
import type { DurableOperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import type { IdentityLifecycle } from '../model/IdentityAction';
import { identityReply, identityRequest, type IdentityLifecycleCheckpoint, type PreparedIdentityLifecycle } from '../model/IdentityExecution';

export class PasswordResetHandler implements DurableOperationHandler<'identity.password.reset', PreparedIdentityLifecycle<unknown>, IdentityLifecycleCheckpoint<unknown>, 'write', unknown> {
  readonly operation = 'identity.password.reset' as const;
  readonly mode = 'write' as const;

  constructor(private readonly lifecycle: IdentityLifecycle<unknown, unknown>) {}

  load(input: OperationInputFor<'identity.password.reset'>, context: HandlerContext<'identity.password.reset'>): Promise<unknown> {
    const request = identityRequest(this.operation, input, context);
    return this.lifecycle.load ? this.lifecycle.load(request, context.transaction) : Promise.resolve(undefined);
  }

  async prepare(input: OperationInputFor<'identity.password.reset'>, context: PrepareContext<'identity.password.reset'>, loaded: unknown): Promise<PreparedIdentityLifecycle<unknown>> {
    const request = identityRequest(this.operation, input, context);
    const preparation = this.lifecycle.prepare ? await this.lifecycle.prepare(request, loaded) : loaded;
    return Object.freeze({ request, preparation });
  }

  async commit(_input: OperationInputFor<'identity.password.reset'>, prepared: PreparedIdentityLifecycle<unknown>, context: CommitContext<'identity.password.reset'>) {
    const result = await this.lifecycle.execute(prepared.request, context.transaction, prepared.preparation);
    return Object.freeze({
      checkpoint: Object.freeze({ request: prepared.request, result, preparation: prepared.preparation }),
      response: identityReply<'identity.password.reset'>(result),
    });
  }

  async finalize(
    _input: OperationInputFor<'identity.password.reset'>,
    checkpoint: IdentityLifecycleCheckpoint<unknown>,
    _context: FinalizeContext<'identity.password.reset'>
  ): Promise<OperationReply<OperationOutputFor<'identity.password.reset'>>> {
    const result = this.lifecycle.finalize ? await this.lifecycle.finalize(checkpoint.request, checkpoint.result, checkpoint.preparation) : checkpoint.result;
    return identityReply<'identity.password.reset'>(result);
  }

  discard(prepared: PreparedIdentityLifecycle<unknown>, cause: unknown): Promise<void> {
    return this.lifecycle.discard?.(prepared.request, prepared.preparation, cause) ?? Promise.resolve();
  }
}
