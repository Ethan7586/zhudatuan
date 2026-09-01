import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { CommitContext, FinalizeContext, HandlerContext, PrepareContext } from '../../../../foundation/application/HandlerContext';
import type { DurableOperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import type { IdentityLifecycle } from '../model/IdentityAction';
import { identityReply, identityRequest, type IdentityLifecycleCheckpoint, type PreparedIdentityLifecycle } from '../model/IdentityExecution';
import type { SessionCompletionScope } from '../service/CompleteSession';

export class SessionsCompleteHandler implements DurableOperationHandler<'identity.sessions.complete', PreparedIdentityLifecycle<SessionCompletionScope>, IdentityLifecycleCheckpoint<SessionCompletionScope>, 'write', SessionCompletionScope> {
  readonly operation = 'identity.sessions.complete' as const;
  readonly mode = 'write' as const;

  constructor(private readonly lifecycle: IdentityLifecycle<SessionCompletionScope, SessionCompletionScope>) {}

  load(input: OperationInputFor<'identity.sessions.complete'>, context: HandlerContext<'identity.sessions.complete'>): Promise<SessionCompletionScope> {
    const request = identityRequest(this.operation, input, context);
    if (!this.lifecycle.load) throw new Error('IDENTITY_SESSION_COMPLETION_LOAD_REQUIRED');
    return this.lifecycle.load(request, context.transaction);
  }

  async prepare(input: OperationInputFor<'identity.sessions.complete'>, context: PrepareContext<'identity.sessions.complete'>, loaded: SessionCompletionScope): Promise<PreparedIdentityLifecycle<SessionCompletionScope>> {
    const request = identityRequest(this.operation, input, context);
    const preparation = this.lifecycle.prepare ? await this.lifecycle.prepare(request, loaded) : loaded;
    return Object.freeze({ request, preparation });
  }

  transactionScope(_input: OperationInputFor<'identity.sessions.complete'>, prepared: PreparedIdentityLifecycle<SessionCompletionScope>): string {
    return prepared.preparation.scope;
  }

  async commit(_input: OperationInputFor<'identity.sessions.complete'>, prepared: PreparedIdentityLifecycle<SessionCompletionScope>, context: CommitContext<'identity.sessions.complete'>) {
    const result = await this.lifecycle.execute(prepared.request, context.transaction, prepared.preparation);
    return Object.freeze({ checkpoint: Object.freeze({ request: prepared.request, result, preparation: prepared.preparation }), response: identityReply<'identity.sessions.complete'>(result) });
  }

  async finalize(
    _input: OperationInputFor<'identity.sessions.complete'>,
    checkpoint: IdentityLifecycleCheckpoint<SessionCompletionScope>,
    _context: FinalizeContext<'identity.sessions.complete'>
  ): Promise<OperationReply<OperationOutputFor<'identity.sessions.complete'>>> {
    const result = this.lifecycle.finalize ? await this.lifecycle.finalize(checkpoint.request, checkpoint.result, checkpoint.preparation) : checkpoint.result;
    return identityReply<'identity.sessions.complete'>(result);
  }

  discard(prepared: PreparedIdentityLifecycle<SessionCompletionScope>, cause: unknown): Promise<void> {
    return this.lifecycle.discard?.(prepared.request, prepared.preparation, cause) ?? Promise.resolve();
  }
}
