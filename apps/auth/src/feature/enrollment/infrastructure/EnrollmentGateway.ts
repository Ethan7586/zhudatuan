import { TransportError } from '@shop/sdk';
import type { AuthEnvironment } from '../../../config/Environment';
import type { IdentitySdk } from '../../../shared/api/Client';
import { commandContext, queryContext } from '../../../shared/api/Context';
import { exchangeSession } from '../../../shared/api/Exchange';
import type { AuthorizationJourneyPort } from '../../../shared/security/AuthorizationJourney';
import type { SessionRequest } from '../../../shared/security/ReturnTarget';
import type { BootstrapPort } from '../../bootstrap/public/BootstrapPort';
import type { EnrollmentCompletion } from '../model/Enrollment';
import type { EnrollmentPort } from '../public/EnrollmentPort';
import { mapEnrollment } from './EnrollmentMapper';

export class EnrollmentGateway implements EnrollmentPort {
  constructor(
    private readonly sdk: IdentitySdk,
    private readonly environment: AuthEnvironment,
    private readonly bootstrap: BootstrapPort,
    private readonly journey: AuthorizationJourneyPort
  ) {}

  read(id: string, session: SessionRequest, signal?: AbortSignal) {
    return this.sdk.enrollmentsRead({ path: { id } }, queryContext(this.environment, session.target, signal)).then(mapEnrollment);
  }

  async complete(input: EnrollmentCompletion, session: SessionRequest, signal?: AbortSignal) {
    const authorization = this.journey.require(input.id);
    const bootstrap = await this.bootstrap.read(session, signal);
    const body =
      input.subjectMode === 'bound'
        ? {
            mode: 'bound' as const,
            challenge: input.challenge,
            code: input.code.trim(),
            password: input.password,
            ...(input.displayName === undefined ? {} : { displayName: input.displayName.trim() }),
            termsAccepted: true as const,
            termsHash: input.termsHash,
            authorization: authorization.request,
          }
        : {
            mode: 'campaign' as const,
            subject: input.subject?.trim() ?? '',
            challenge: input.challenge,
            code: input.code.trim(),
            password: input.password,
            displayName: input.displayName?.trim() ?? '',
            termsAccepted: true as const,
            termsHash: input.termsHash,
            authorization: authorization.request,
          };
    const result = await this.sdk.enrollmentsComplete({ path: { id: input.id }, body }, commandContext(this.environment, session.target, bootstrap.csrf, signal));
    if (result.kind === 'enrolled') {
      if (result.target !== session.target) throw new TransportError('CONTRACT_INVALID', undefined, false);
      this.journey.clear(input.id);
      return Object.freeze(result);
    }
    const redirectUrl = await exchangeSession(this.sdk, this.environment, result, authorization, session.target, bootstrap.csrf, signal);
    this.journey.clear(input.id);
    return Object.freeze({ kind: 'authenticated' as const, redirectUrl });
  }
}
