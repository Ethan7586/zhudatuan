import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { CommitContext, FinalizeContext, HandlerContext, PrepareContext } from '../../../../foundation/application/HandlerContext';
import type { DurableOperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import type { OperationRequest, OperationResult } from '../../../../foundation/application/OperationRequest';
import type { IdentityAction, IdentityLifecycle } from '../model/IdentityAction';
import { identityReply, identityRequest } from '../model/IdentityExecution';
import type { LoadedFederationStart, PreparedFederationStart } from '../service/FederationService';
import type { InvitationAuthenticator, LoadedInvitationAuthentication, PreparedInvitationAuthentication } from '../service/InvitationAuthenticator';
import { authenticationOperationResult } from '../service/AuthenticationStrategy';

type LoadedSession = Readonly<{ kind: 'authentication' }> | Readonly<{ kind: 'federation'; value: LoadedFederationStart }> | Readonly<{ kind: 'invitation'; value: LoadedInvitationAuthentication }>;
type PreparedSession =
  | Readonly<{ kind: 'authentication'; request: OperationRequest }>
  | Readonly<{ kind: 'federation'; request: OperationRequest; preparation: PreparedFederationStart }>
  | Readonly<{ kind: 'invitation'; request: OperationRequest; preparation: PreparedInvitationAuthentication }>;

export class SessionsCreateHandler implements DurableOperationHandler<'identity.sessions.create', PreparedSession, OperationResult, 'write', LoadedSession> {
  readonly operation = 'identity.sessions.create' as const;
  readonly mode = 'write' as const;

  constructor(
    private readonly authenticate: IdentityAction,
    private readonly federation: IdentityLifecycle<PreparedFederationStart, LoadedFederationStart>,
    private readonly invitation: InvitationAuthenticator
  ) {}

  async load(input: OperationInputFor<'identity.sessions.create'>, context: HandlerContext<'identity.sessions.create'>): Promise<LoadedSession> {
    const request = identityRequest(this.operation, input, context);
    if (input.body.method === 'federation') {
      if (!this.federation.load) throw new Error('FEDERATION_LOAD_REQUIRED');
      return Object.freeze({ kind: 'federation', value: await this.federation.load(request, context.transaction) });
    }
    if (input.body.method === 'invitation') {
      return Object.freeze({ kind: 'invitation', value: await this.invitation.load(request, context.transaction, input.body) });
    }
    return Object.freeze({ kind: 'authentication' });
  }

  async prepare(input: OperationInputFor<'identity.sessions.create'>, context: PrepareContext<'identity.sessions.create'>, loaded: LoadedSession): Promise<PreparedSession> {
    const request = identityRequest(this.operation, input, context);
    if (loaded.kind === 'federation') {
      if (!this.federation.prepare) throw new Error('FEDERATION_PREPARE_REQUIRED');
      return Object.freeze({ kind: 'federation', request, preparation: await this.federation.prepare(request, loaded.value) });
    }
    if (loaded.kind === 'invitation') {
      return Object.freeze({ kind: 'invitation', request, preparation: await this.invitation.prepare(request, loaded.value) });
    }
    return Object.freeze({ kind: 'authentication', request });
  }

  transactionScope(_input: OperationInputFor<'identity.sessions.create'>, prepared: PreparedSession): string | undefined {
    return prepared.kind === 'invitation' ? prepared.preparation.loaded.invitation.state.organization : undefined;
  }

  async commit(input: OperationInputFor<'identity.sessions.create'>, prepared: PreparedSession, context: CommitContext<'identity.sessions.create'>) {
    const result =
      prepared.kind === 'federation'
        ? await this.federation.execute(prepared.request, context.transaction, prepared.preparation)
        : prepared.kind === 'invitation'
          ? authenticationOperationResult(await this.invitation.commit(prepared.request, context.transaction, input.body, prepared.preparation))
          : await this.authenticate(prepared.request, context.transaction);
    return Object.freeze({ checkpoint: result, response: identityReply<'identity.sessions.create'>(result) });
  }

  async finalize(_input: OperationInputFor<'identity.sessions.create'>, checkpoint: OperationResult, _context: FinalizeContext<'identity.sessions.create'>): Promise<OperationReply<OperationOutputFor<'identity.sessions.create'>>> {
    return identityReply<'identity.sessions.create'>(checkpoint);
  }
}
