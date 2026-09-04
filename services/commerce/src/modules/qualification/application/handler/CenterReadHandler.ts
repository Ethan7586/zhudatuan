import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import { keysetPage, queryPage } from '../../../../foundation/application/Validation';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
import type { QualificationRepository } from '../port/QualificationRepository';
import type { QualificationCaseRepository } from '../port/QualificationCaseRepository';

export class CenterReadHandler implements OperationHandler<'qualification.center.read', 'read'> {
  readonly operation = 'qualification.center.read' as const;
  readonly mode = 'read' as const;

  constructor(
    private readonly qualifications: QualificationRepository,
    private readonly cases: QualificationCaseRepository
  ) {}

  async execute(input: OperationInputFor<'qualification.center.read'>, context: HandlerContext<'qualification.center.read'>): Promise<OperationReply<OperationOutputFor<'qualification.center.read'>>> {
    const access = requireSession(context.security);
    const page = queryPage(input, 200);
    const rows = await this.qualifications.policies(context.transaction, { scope: access.scope.id, ...page });
    const cases = await this.cases.cases(context.transaction, access.scope.id, 100);
    const result = keysetPage(rows, page, 'updated_at');
    return {
      status: 200,
      body: {
        ...result,
        items: result.items.map((item) => ({ ...item, versions: [...item.versions] })),
        cases: cases.map((item) => ({ ...item, applicability: item.applicability.map((target) => ({ ...target })) })),
      },
    };
  }
}
