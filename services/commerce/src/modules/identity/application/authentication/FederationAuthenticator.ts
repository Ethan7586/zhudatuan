import { DomainError } from '../../../../foundation/domain/DomainError';
import type { OperationDatabase } from '../../../../foundation/application/ModuleOperations';
import type { OperationRequest } from '../../../../foundation/application/OperationExecution';
import type { AuthenticationBody, AuthenticationReply, AuthenticationStrategy } from './AuthenticationStrategy';
import type { FederationService } from '../service/FederationService';
import type { ReturnTargetPort } from '../port/ReturnTargetPort';
import { requestContext } from '../command/StartFederation';

export class FederationAuthenticator implements AuthenticationStrategy {
  readonly method = 'federation' as const;
  constructor(
    private readonly federation: FederationService,
    private readonly returns: ReturnTargetPort
  ) {}
  async authenticate(request: OperationRequest, database: OperationDatabase, body: AuthenticationBody): Promise<AuthenticationReply> {
    if (body.method !== this.method) throw new Error('AUTHENTICATION_METHOD_MISMATCH');
    const target = body.target;
    if (target !== 'console' && target !== 'storefront') throw new Error('AUTH_RETURN_TARGET_INVALID');
    if (typeof body.provider !== 'string' || !/^[0-9a-f-]{36}$/.test(body.provider)) throw new DomainError('VALIDATION_FAILED');
    const started = await this.federation.start(database, { provider: body.provider, returntarget: this.returns.issue(target).proof, authorization: body.authorization }, requestContext(request));
    const location = started.headers?.location;
    if (typeof location !== 'string') throw new DomainError('IDENTITY_PROVIDER_UNAVAILABLE');
    return {
      status: 202,
      headers: { 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' },
      result: { kind: 'proofRequired', proof: { reference: location, expiresAt: new Date(Date.now() + 300_000).toISOString(), method: 'sso', target } },
    };
  }
}
