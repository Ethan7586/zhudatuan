import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { CommitContext, FinalizeContext, HandlerContext, PrepareContext } from '../../../../pipeline/HandlerContext';
import type { DurableOperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import type { OperationRequest, OperationResult } from '../../../../pipeline/OperationRequest';
import { identityReply, identityRequest } from '../model/IdentityExecution';
import type { LoadedInvitationResolution, PreparedInvitationResolution, ResolveInvitation } from '../service/ResolveInvitation';

interface PreparedResolution {
  readonly request: OperationRequest;
  readonly resolution: PreparedInvitationResolution;
}

interface ResolveCheckpoint {
  readonly request: OperationRequest;
  readonly result: OperationResult;
}

export class InvitationsResolveHandler implements DurableOperationHandler<'identity.invitations.resolve', PreparedResolution, ResolveCheckpoint, 'write', LoadedInvitationResolution> {
  readonly operation = 'identity.invitations.resolve' as const;
  readonly mode = 'write' as const;

  constructor(private readonly resolver: ResolveInvitation) {}

  load(input: OperationInputFor<'identity.invitations.resolve'>, context: HandlerContext<'identity.invitations.resolve'>): Promise<LoadedInvitationResolution> {
    return this.resolver.load(identityRequest(this.operation, input, context), context.transaction);
  }

  async prepare(input: OperationInputFor<'identity.invitations.resolve'>, context: PrepareContext<'identity.invitations.resolve'>, loaded: LoadedInvitationResolution): Promise<PreparedResolution> {
    const request = identityRequest(this.operation, input, context);
    return Object.freeze({ request, resolution: await this.resolver.prepare(request, loaded) });
  }

  transactionScope(_input: OperationInputFor<'identity.invitations.resolve'>, prepared: PreparedResolution): string {
    return prepared.resolution.loaded.invitation.state.organization;
  }

  async commit(_input: OperationInputFor<'identity.invitations.resolve'>, prepared: PreparedResolution, context: CommitContext<'identity.invitations.resolve'>) {
    const result = await this.resolver.commit(prepared.request, context.transaction, prepared.resolution);
    return Object.freeze({ checkpoint: Object.freeze({ request: prepared.request, result }), response: identityReply<'identity.invitations.resolve'>(result) });
  }

  finalize(_input: OperationInputFor<'identity.invitations.resolve'>, checkpoint: ResolveCheckpoint, _context: FinalizeContext<'identity.invitations.resolve'>): Promise<OperationReply<OperationOutputFor<'identity.invitations.resolve'>>> {
    return Promise.resolve(identityReply<'identity.invitations.resolve'>(this.resolver.finalize(checkpoint.request, checkpoint.result)));
  }

  discard(prepared: PreparedResolution, cause: unknown): Promise<void> {
    return this.resolver.discard(prepared.request, prepared.resolution, cause);
  }
}
