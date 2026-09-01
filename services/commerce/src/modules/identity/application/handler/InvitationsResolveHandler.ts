import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { CommitContext, FinalizeContext, PrepareContext } from '../../../../foundation/application/HandlerContext';
import type { DurableOperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import type { OperationRequest, OperationResult } from '../../../../foundation/application/OperationRequest';
import { identityReply, identityRequest } from '../model/IdentityExecution';
import type { ResolveInvitation } from '../service/ResolveInvitation';

interface PreparedInvitationResolution {
  readonly request: OperationRequest;
  readonly resolution: Readonly<{ target: 'console' | 'storefront' }>;
}

export class InvitationsResolveHandler implements DurableOperationHandler<'identity.invitations.resolve', PreparedInvitationResolution, OperationResult, 'write'> {
  readonly operation = 'identity.invitations.resolve' as const;
  readonly mode = 'write' as const;

  constructor(private readonly resolver: ResolveInvitation) {}

  async prepare(input: OperationInputFor<'identity.invitations.resolve'>, context: PrepareContext<'identity.invitations.resolve'>): Promise<PreparedInvitationResolution> {
    const request = identityRequest(this.operation, input, context);
    return Object.freeze({ request, resolution: await this.resolver.prepare(request) });
  }

  async commit(_input: OperationInputFor<'identity.invitations.resolve'>, prepared: PreparedInvitationResolution, context: CommitContext<'identity.invitations.resolve'>) {
    const result = await this.resolver.execute(prepared.request, context.transaction, prepared.resolution);
    return Object.freeze({ checkpoint: result, response: identityReply<'identity.invitations.resolve'>(result) });
  }

  finalize(_input: OperationInputFor<'identity.invitations.resolve'>, checkpoint: OperationResult, _context: FinalizeContext<'identity.invitations.resolve'>): Promise<OperationReply<OperationOutputFor<'identity.invitations.resolve'>>> {
    return Promise.resolve(identityReply<'identity.invitations.resolve'>(checkpoint));
  }
}
