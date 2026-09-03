import type { AuthEnvironment } from '../../../config/Environment';
import type { IdentitySdk } from '../../../shared/api/Client';
import { commandContext, queryContext } from '../../../shared/api/Context';
import { exchangeSession } from '../../../shared/api/Exchange';
import { createAuthorization } from '../../../shared/security/Authorization';
import type { BootstrapPort } from '../../bootstrap/public/BootstrapPort';
import type { EnrollmentCompletion } from '../model/Enrollment';
import type { InvitationResolution } from '../model/Invitation';
import type { InvitationPort } from '../public/InvitationPort';
import { mapEnrollment, mapInvitation } from './InvitationMapper';

export class InvitationGateway implements InvitationPort {
  constructor(private readonly sdk: IdentitySdk, private readonly environment: AuthEnvironment, private readonly bootstrap: BootstrapPort) {}
  async resolve(input: InvitationResolution) {
    const [authorization, bootstrap] = await Promise.all([createAuthorization(), this.bootstrap.read(input.target, input.returns, input.signal)]);
    const result = await this.sdk.invitationsResolve(
      { body: { code: input.code.trim(), target: input.target, returnTarget: bootstrap.returnTarget, authorization: authorization.request } },
      commandContext(this.environment, input.target, bootstrap.csrf, input.signal)
    );
    if (result.kind !== 'session') return mapInvitation(result);
    const redirectUrl = await exchangeSession(this.sdk, this.environment, result, authorization, input.target, bootstrap.csrf, input.signal);
    return Object.freeze({ kind: 'authenticated' as const, redirectUrl });
  }
  read(id: string, signal?: AbortSignal) {
    return this.sdk.enrollmentsRead({ path: { id } }, queryContext(this.environment, 'storefront', signal)).then(mapEnrollment);
  }
  async complete(input: EnrollmentCompletion, signal?: AbortSignal) {
    const [authorization, bootstrap] = await Promise.all([createAuthorization(), this.bootstrap.read('storefront', {}, signal)]);
    const body = input.subjectMode === 'bound'
      ? { mode: 'bound' as const, challenge: input.challenge, code: input.code.trim(), password: input.password, ...(input.displayName === undefined ? {} : { displayName: input.displayName.trim() }), termsAccepted: true as const, termsHash: input.termsHash, authorization: authorization.request }
      : { mode: 'campaign' as const, subject: input.subject?.trim() ?? '', challenge: input.challenge, code: input.code.trim(), password: input.password, displayName: input.displayName?.trim() ?? '', termsAccepted: true as const, termsHash: input.termsHash, authorization: authorization.request };
    const result = await this.sdk.enrollmentsComplete({ path: { id: input.id }, body }, commandContext(this.environment, 'storefront', bootstrap.csrf, signal));
    if (result.kind === 'enrolled') return Object.freeze(result);
    const redirectUrl = await exchangeSession(this.sdk, this.environment, result, authorization, 'storefront', bootstrap.csrf, signal);
    return Object.freeze({ kind: 'authenticated' as const, redirectUrl });
  }
}
