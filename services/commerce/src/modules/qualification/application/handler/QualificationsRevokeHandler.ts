import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import { DomainError } from '../../../../foundation/domain/DomainError';
import { bodyRecord, textField } from '../../../../foundation/application/Validation';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
import { qualificationRevokedEvent } from '../../domain/event/QualificationEvents';
import { QualificationCase } from '../../domain/model/QualificationCase';
import type { QualificationCaseRepository } from '../port/QualificationCaseRepository';

export class QualificationsRevokeHandler implements OperationHandler<'qualification.qualifications.revoke', 'write'> {
  readonly operation = 'qualification.qualifications.revoke' as const;
  readonly mode = 'write' as const;

  constructor(private readonly cases: QualificationCaseRepository) {}

  async execute(
    input: OperationInputFor<'qualification.qualifications.revoke'>,
    context: WriteHandlerContext<'qualification.qualifications.revoke'>
  ): Promise<OperationReply<OperationOutputFor<'qualification.qualifications.revoke'>>> {
    const access = requireSession(context.security);
    if (context.expectedVersion === undefined) throw new DomainError('EXPECTED_VERSION_REQUIRED');
    const current = await this.cases.lock(context.transaction, access.scope.id, input.path.qualificationid);
    if (!current || current.version !== context.expectedVersion) throw new DomainError('VERSION_CONFLICT');
    const revoked = QualificationCase.restore(current).revoke(access.actor.id, textField(bodyRecord(input), 'reason', 500), new Date().toISOString()).snapshot();
    const saved = await this.cases.save(context.transaction, revoked, context.expectedVersion);
    if (!saved) throw new DomainError('VERSION_CONFLICT');
    return {
      status: 200,
      body: saved as OperationOutputFor<'qualification.qualifications.revoke'>,
      events: [qualificationRevokedEvent(revoked, { actor: access.actor.id, trace: context.traceId })],
    };
  }
}
