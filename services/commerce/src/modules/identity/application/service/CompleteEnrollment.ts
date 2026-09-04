import { randomUUID } from 'node:crypto';
import type { IdentityEnrollmentsCompleteBody } from '@shop/contract';

import { DomainError } from '../../../../foundation/domain/DomainError';
import type { KmsClient } from '../../../../foundation/application/KmsPort';
import { bodyRecord, textField } from '../../../../foundation/application/Validation';
import { requirePreauth } from '../../../../foundation/security/OperationSecurityContext';
import { AuthTransaction } from '../../domain/model/AuthTransaction';
import { PasswordPolicy } from '../../domain/policy/PasswordPolicy';
import { canonicalMobile } from '../../domain/value/IdentitySubject';
import { identityLifecycle as operationLifecycle, type IdentityLifecycle as OperationLifecycle } from '../model/IdentityAction';
import type { EnrollmentDraft, EnrollmentInvitationScope, EnrollIdentity } from './EnrollIdentity';

export class CompleteEnrollment {
  constructor(
    private readonly kms: KmsClient,
    private readonly enrollment: EnrollIdentity,
    private readonly passwords = new PasswordPolicy()
  ) {}

  lifecycle(): OperationLifecycle<EnrollmentDraft, EnrollmentInvitationScope> {
    return operationLifecycle({
      load: async (request, context) => {
        const preauth = requirePreauth(request.security, 'enrollment');
        if (request.input.path.id !== preauth.reference) throw new DomainError('PREAUTH_REQUIRED');
        return this.enrollment.load(context, preauth.reference, preauth.target);
      },
      prepare: async (request, loaded) => {
        const body = bodyRecord(request.input) as IdentityEnrollmentsCompleteBody;
        const preauth = requirePreauth(request.security, 'enrollment');
        if (body.mode !== loaded.mode || !preauth.authorization || !preauth.returnTarget) throw new DomainError('PREAUTH_REQUIRED');
        const authorization = AuthTransaction.start(body.authorization);
        if (
          authorization.stateHash !== preauth.authorization.stateHash ||
          authorization.nonceHash !== preauth.authorization.nonceHash ||
          authorization.challenge !== preauth.authorization.challenge
        ) {
          throw new DomainError('PREAUTH_REQUIRED');
        }
        const principal = loaded.principal ?? `principal:${randomUUID()}`;
        const subject =
          body.mode === 'bound'
            ? canonicalMobile(await this.kms.decrypt('pii', 'identity/mobile', requiredCiphertext(loaded.mobileCiphertext), { principal }))
            : canonicalMobile(textField(body, 'subject', 32));
        const [password, mobile] = await Promise.all([
          this.passwords.hash(textField(body, 'password', 128)),
          this.kms.encrypt('pii', 'identity/mobile', subject, { principal }),
        ]);
        const display = body.mode === 'campaign' ? textField(body, 'displayName', 128) : body.displayName?.trim() || loaded.displayName;
        if (!display) throw new DomainError('VALIDATION_FAILED');
        return Object.freeze({ ...loaded, body, subject, password, mobile, principal, display, authorization, returnTarget: preauth.returnTarget });
      },
      execute: (request, database, prepared) => this.enrollment.complete(request, database, prepared),
    });
  }
}

function requiredCiphertext(value: string | null): string {
  if (!value) throw new DomainError('INVITATION_INVALID');
  return value;
}
