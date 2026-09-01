import { identityLifecycle as operationLifecycle, type IdentityLifecycle as OperationLifecycle } from '../model/IdentityAction';
import { randomUUID } from 'node:crypto';

import { bodyRecord, textField } from '../../../../foundation/interface/Validation';
import { requirePreauth } from '../../../../foundation/security/OperationSecurityContext';
import { DomainError } from '../../../../foundation/domain/DomainError';
import type { KmsClient } from '../../../../foundation/infrastructure/KmsClient';
import { canonicalMobile } from '../../domain/value/IdentitySubject';
import { PasswordPolicy } from '../../domain/policy/PasswordPolicy';
import type { EnrollmentDraft, EnrollmentInvitationScope, EnrollmentService } from '../service/EnrollmentService';
import type { IdentityEnrollmentsCompleteBody } from '@shop/contract';

export class CompleteEnrollment {
  constructor(
    private readonly kms: KmsClient,
    private readonly enrollment: EnrollmentService,
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
        const subject = canonicalMobile(textField(body, 'subject', 32));
        const preauth = requirePreauth(request.security, 'enrollment');
        const principal = preauth.principal ?? `principal:${randomUUID()}`;
        const [password, mobile] = await Promise.all([this.passwords.hash(textField(body, 'password', 128)), this.kms.encrypt('pii', 'identity/mobile', subject, { principal })]);
        return { ...loaded, body, subject, password, mobile, principal };
      },
      execute: (request, database, prepared) => this.enrollment.complete(request, database, prepared),
    });
  }
}
