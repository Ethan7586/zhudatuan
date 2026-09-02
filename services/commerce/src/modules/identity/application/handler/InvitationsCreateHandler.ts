import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { CommitContext, FinalizeContext, HandlerContext, PrepareContext } from '../../../../foundation/application/HandlerContext';
import type { DurableOperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import type { IdentityLifecycle } from '../model/IdentityAction';
import { identityReply, identityRequest, type IdentityLifecycleCheckpoint, type PreparedIdentityLifecycle } from '../model/IdentityExecution';
import type { LoadedInvitation, PreparedInvitation } from '../service/CreateInvitation';

export class InvitationsCreateHandler
  implements DurableOperationHandler<'identity.invitations.create', PreparedIdentityLifecycle<PreparedInvitation>, IdentityLifecycleCheckpoint<PreparedInvitation>, 'write', LoadedInvitation>
{
  readonly operation = 'identity.invitations.create' as const;
  readonly mode = 'write' as const;

  constructor(private readonly lifecycle: IdentityLifecycle<PreparedInvitation, LoadedInvitation>) {}

  load(input: OperationInputFor<'identity.invitations.create'>, context: HandlerContext<'identity.invitations.create'>): Promise<LoadedInvitation> {
    const request = identityRequest(this.operation, input, context);
    if (!this.lifecycle.load) throw new Error('INVITATION_LOAD_REQUIRED');
    return this.lifecycle.load(request, context.transaction);
  }

  async prepare(input: OperationInputFor<'identity.invitations.create'>, context: PrepareContext<'identity.invitations.create'>, loaded: LoadedInvitation): Promise<PreparedIdentityLifecycle<PreparedInvitation>> {
    const request = identityRequest(this.operation, input, context);
    if (!this.lifecycle.prepare) throw new Error('INVITATION_PREPARE_REQUIRED');
    return Object.freeze({ request, preparation: await this.lifecycle.prepare(request, loaded) });
  }

  transactionScope(_input: OperationInputFor<'identity.invitations.create'>, prepared: PreparedIdentityLifecycle<PreparedInvitation>): string | undefined {
    return prepared.preparation.kind === 'enrollment' ? prepared.preparation.organization : undefined;
  }

  async commit(_input: OperationInputFor<'identity.invitations.create'>, prepared: PreparedIdentityLifecycle<PreparedInvitation>, context: CommitContext<'identity.invitations.create'>) {
    const result = await this.lifecycle.execute(prepared.request, context.transaction, prepared.preparation);
    return Object.freeze({
      checkpoint: Object.freeze({ request: prepared.request, result, preparation: prepared.preparation }),
      response: identityReply<'identity.invitations.create'>(result),
    });
  }

  async finalize(
    _input: OperationInputFor<'identity.invitations.create'>,
    checkpoint: IdentityLifecycleCheckpoint<PreparedInvitation>,
    _context: FinalizeContext<'identity.invitations.create'>
  ): Promise<OperationReply<OperationOutputFor<'identity.invitations.create'>>> {
    const result = this.lifecycle.finalize ? await this.lifecycle.finalize(checkpoint.request, checkpoint.result, checkpoint.preparation) : checkpoint.result;
    return identityReply<'identity.invitations.create'>(result);
  }

  idempotencyResponse(response: OperationReply<OperationOutputFor<'identity.invitations.create'>>): OperationReply<OperationOutputFor<'identity.invitations.create'>> {
    return Object.freeze({
      ...response,
      body: Object.freeze({ ...response.body, code: '' }),
      headers: Object.freeze({ ...response.headers, 'x-invitation-code': 'unavailable' }),
    });
  }

  discard(prepared: PreparedIdentityLifecycle<PreparedInvitation>, cause: unknown): Promise<void> {
    return this.lifecycle.discard?.(prepared.request, prepared.preparation, cause) ?? Promise.resolve();
  }
}
