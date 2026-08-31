import { randomUUID } from 'node:crypto';
import { operationLifecycle, type OperationLifecycle } from '../../../../foundation/application/ModuleOperations';
import { bodyRecord, textField } from '../../../../foundation/interface/Validation';
import { requirePreauth } from '../../../../foundation/security/OperationSecurityContext';
import type { KmsClient } from '../../../../foundation/infrastructure/KmsClient';
import { canonicalMobile } from '../../IdentitySubject';
import { PasswordPolicy } from '../../domain/policy/PasswordPolicy';
import type { EnrollmentDraft, EnrollmentService } from '../service/EnrollmentService';
import type { IdentityEnrollmentsCompleteBody } from '@shop/contract';

export class CompleteEnrollment {
  constructor(
    private readonly kms: KmsClient,
    private readonly enrollment: EnrollmentService,
    private readonly passwords = new PasswordPolicy()
  ) {}

  lifecycle(): OperationLifecycle<EnrollmentDraft> {
    return operationLifecycle({
      prepare: async (request) => {
        const body = bodyRecord(request) as IdentityEnrollmentsCompleteBody;
        const subject = canonicalMobile(textField(body, 'subject', 32));
        const preauth = requirePreauth(request.security, 'enrollment');
        const principal = preauth.principal ?? `principal:${randomUUID()}`;
        const [password, mobile] = await Promise.all([this.passwords.hash(textField(body, 'password', 128)), this.kms.encrypt('pii', 'identity/mobile', subject, { principal })]);
        return { body, subject, password, mobile, principal };
      },
      execute: (request, database, prepared) => this.enrollment.complete(request, database, prepared),
    });
  }
}
