import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import { bodyRecord, textField } from '../../../../foundation/interface/Validation';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
import type { QualificationRepository } from '../port/QualificationRepository';

export class DecisionsPreviewHandler implements OperationHandler<'qualification.decisions.preview', 'write'> {
  readonly operation = 'qualification.decisions.preview' as const;
  readonly mode = 'write' as const;

  constructor(private readonly qualifications: QualificationRepository) {}

  async execute(input: OperationInputFor<'qualification.decisions.preview'>, context: WriteHandlerContext<'qualification.decisions.preview'>): Promise<OperationReply<OperationOutputFor<'qualification.decisions.preview'>>> {
    const access = requireSession(context.security);
    const body = bodyRecord(input);
    const decisions = await this.qualifications.preview(context.transaction, access.scope.id, textField(body, 'member'), textField(body, 'resource'));
    return { status: 200, body: { decisions: [...decisions] } };
  }
}
