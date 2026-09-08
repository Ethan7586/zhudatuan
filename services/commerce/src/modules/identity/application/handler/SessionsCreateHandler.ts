import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { CommitContext, FinalizeContext, HandlerContext, PrepareContext } from '../../../../pipeline/HandlerContext';
import type { DurableOperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import type { OperationRequest, OperationResult } from '../../../../pipeline/OperationRequest';
import type { IdentityAction, IdentityLifecycle } from '../model/IdentityAction';
import { identityReply, identityRequest } from '../model/IdentityExecution';
import type { LoadedFederationStart, PreparedFederationStart } from '../service/FederateIdentity';

type LoadedSession = Readonly<{ kind: 'authentication' }> | Readonly<{ kind: 'federation'; value: LoadedFederationStart }>;
type PreparedSession = Readonly<{ kind: 'authentication'; request: OperationRequest }> | Readonly<{ kind: 'federation'; request: OperationRequest; preparation: PreparedFederationStart }>;

export class SessionsCreateHandler implements DurableOperationHandler<'identity.sessions.create', PreparedSession, OperationResult, 'write', LoadedSession> {
  readonly operation = 'identity.sessions.create' as const;
  readonly mode = 'write' as const;
  readonly isolation = 'read committed' as const;

  constructor(
    private readonly authenticate: IdentityAction,
    private readonly federation: IdentityLifecycle<PreparedFederationStart, LoadedFederationStart>
  ) {}

  async load(input: OperationInputFor<'identity.sessions.create'>, context: HandlerContext<'identity.sessions.create'>): Promise<LoadedSession> {
    const request = identityRequest(this.operation, input, context);
    if (input.body.method === 'federation') {
      if (!this.federation.load) throw new Error('FEDERATION_LOAD_REQUIRED');
      return Object.freeze({ kind: 'federation', value: await this.federation.load(request, context.transaction) });
    }
    return Object.freeze({ kind: 'authentication' });
  }

  async prepare(input: OperationInputFor<'identity.sessions.create'>, context: PrepareContext<'identity.sessions.create'>, loaded: LoadedSession): Promise<PreparedSession> {
    const request = identityRequest(this.operation, input, context);
    if (loaded.kind === 'federation') {
      if (!this.federation.prepare) throw new Error('FEDERATION_PREPARE_REQUIRED');
      return Object.freeze({ kind: 'federation', request, preparation: await this.federation.prepare(request, loaded.value) });
    }
    return Object.freeze({ kind: 'authentication', request });
  }

  async commit(_input: OperationInputFor<'identity.sessions.create'>, prepared: PreparedSession, context: CommitContext<'identity.sessions.create'>) {
    const result = prepared.kind === 'federation' ? await this.federation.execute(prepared.request, context.transaction, prepared.preparation) : await this.authenticate(prepared.request, context.transaction);
    return Object.freeze({ checkpoint: result, response: identityReply<'identity.sessions.create'>(result) });
  }

  async finalize(_input: OperationInputFor<'identity.sessions.create'>, checkpoint: OperationResult, _context: FinalizeContext<'identity.sessions.create'>): Promise<OperationReply<OperationOutputFor<'identity.sessions.create'>>> {
    return identityReply<'identity.sessions.create'>(checkpoint);
  }
}
