import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { CommitContext, FinalizeContext, HandlerContext, PrepareContext } from '../../../../pipeline/HandlerContext';
import type { DurableOperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import type { OperationRequest, OperationResult } from '../../../../pipeline/OperationRequest';
import type { IdentityLifecycle } from '../model/IdentityAction';
import { identityReply, identityRequest } from '../model/IdentityExecution';
import type { LoadedFederationStart, PreparedFederationStart } from '../service/FederateIdentity';
import type { LoadedAuthentication, PreparedAuthentication } from '../service/AuthenticationStrategy';

type LoadedSession = Readonly<{ kind: 'authentication'; value: LoadedAuthentication }> | Readonly<{ kind: 'federation'; value: LoadedFederationStart }>;
type PreparedSession = Readonly<{ kind: 'authentication'; request: OperationRequest; preparation: PreparedAuthentication }> | Readonly<{ kind: 'federation'; request: OperationRequest; preparation: PreparedFederationStart }>;

export class SessionsCreateHandler implements DurableOperationHandler<'identity.sessions.create', PreparedSession, OperationResult, 'write', LoadedSession> {
  readonly operation = 'identity.sessions.create' as const;
  readonly mode = 'write' as const;
  readonly isolation = 'read committed' as const;

  constructor(
    private readonly authenticate: IdentityLifecycle<PreparedAuthentication, LoadedAuthentication>,
    private readonly federation: IdentityLifecycle<PreparedFederationStart, LoadedFederationStart>
  ) {}

  async load(input: OperationInputFor<'identity.sessions.create'>, context: HandlerContext<'identity.sessions.create'>): Promise<LoadedSession> {
    const request = identityRequest(this.operation, input, context);
    if (input.body.method === 'federation') {
      if (!this.federation.load) throw new Error('FEDERATION_LOAD_REQUIRED');
      return Object.freeze({ kind: 'federation', value: await this.federation.load(request, context.transaction) });
    }
    if (!this.authenticate.load) throw new Error('AUTHENTICATION_LOAD_REQUIRED');
    return Object.freeze({ kind: 'authentication', value: await this.authenticate.load(request, context.transaction) });
  }

  async prepare(input: OperationInputFor<'identity.sessions.create'>, context: PrepareContext<'identity.sessions.create'>, loaded: LoadedSession): Promise<PreparedSession> {
    const request = identityRequest(this.operation, input, context);
    if (loaded.kind === 'federation') {
      if (!this.federation.prepare) throw new Error('FEDERATION_PREPARE_REQUIRED');
      return Object.freeze({ kind: 'federation', request, preparation: await this.federation.prepare(request, loaded.value) });
    }
    if (!this.authenticate.prepare) throw new Error('AUTHENTICATION_PREPARE_REQUIRED');
    return Object.freeze({ kind: 'authentication', request, preparation: await this.authenticate.prepare(request, loaded.value) });
  }

  async commit(_input: OperationInputFor<'identity.sessions.create'>, prepared: PreparedSession, context: CommitContext<'identity.sessions.create'>) {
    const result = prepared.kind === 'federation' ? await this.federation.execute(prepared.request, context.transaction, prepared.preparation) : await this.authenticate.execute(prepared.request, context.transaction, prepared.preparation);
    return Object.freeze({ checkpoint: result, response: identityReply<'identity.sessions.create'>(result) });
  }

  async finalize(_input: OperationInputFor<'identity.sessions.create'>, checkpoint: OperationResult, _context: FinalizeContext<'identity.sessions.create'>): Promise<OperationReply<OperationOutputFor<'identity.sessions.create'>>> {
    return identityReply<'identity.sessions.create'>(checkpoint);
  }
}
