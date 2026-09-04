import type { AuthEnvironment } from '../../../config/Environment';
import type { IdentitySdk } from '../../../shared/api/Client';
import { commandContext } from '../../../shared/api/Context';
import { exchangeSession } from '../../../shared/api/Exchange';
import type { AuthorizationPort } from '../../../shared/security/Authorization';
import type { SessionRequest } from '../../../shared/security/ReturnTarget';
import type { BootstrapPort } from '../../bootstrap/public/BootstrapPort';
import type { Credential } from '../model/Credential';
import type { LoginOutcome } from '../model/Login';
import type { LoginPort } from '../public/LoginPort';
import { mapLogin } from './LoginMapper';

export class LoginGateway implements LoginPort {
  constructor(
    private readonly sdk: IdentitySdk,
    private readonly environment: AuthEnvironment,
    private readonly bootstrap: BootstrapPort,
    private readonly authorizations: AuthorizationPort
  ) {}

  async authenticate(credential: Credential, signal?: AbortSignal): Promise<LoginOutcome> {
    const [authorization, bootstrap] = await Promise.all([this.authorizations.create(), this.bootstrap.read(credential.session, signal)]);
    const body =
      credential.kind === 'password'
        ? { method: 'password' as const, subject: credential.subject.trim(), password: credential.password, target: credential.session.target, returnTarget: bootstrap.returnTarget, authorization: authorization.request }
        : { method: 'otp' as const, subject: credential.subject.trim(), challenge: credential.challenge, code: credential.code.trim(), target: credential.session.target, returnTarget: bootstrap.returnTarget, authorization: authorization.request };
    const result = await this.sdk.sessionsCreate({ body }, commandContext(this.environment, credential.session.target, bootstrap.csrf, signal));
    if (result.kind !== 'session') return mapLogin(result);
    const redirectUrl = await exchangeSession(this.sdk, this.environment, result, authorization, credential.session.target, bootstrap.csrf, signal);
    return Object.freeze({ kind: 'authenticated', redirectUrl });
  }

  async proof(reference: string, code: string, session: SessionRequest, signal?: AbortSignal): Promise<LoginOutcome> {
    const [authorization, bootstrap] = await Promise.all([this.authorizations.create(), this.bootstrap.read(session, signal)]);
    const result = await this.sdk.sessionsComplete(
      { body: { proof: reference, code: code.trim(), returnTarget: bootstrap.returnTarget, authorization: authorization.request } },
      commandContext(this.environment, session.target, bootstrap.csrf, signal)
    );
    const redirectUrl = await exchangeSession(this.sdk, this.environment, result, authorization, session.target, bootstrap.csrf, signal);
    return Object.freeze({ kind: 'authenticated', redirectUrl });
  }
}
