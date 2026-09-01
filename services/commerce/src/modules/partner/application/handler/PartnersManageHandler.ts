import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import { DomainError } from '../../../../foundation/domain/DomainError';
import type { WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import { bodyRecord, textField } from '../../../../foundation/interface/Validation';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
import type { PartnerRepository } from '../port/PartnerRepository';
export class PartnersManageHandler implements OperationHandler<'partner.partners.manage', 'write'> {
  readonly operation = 'partner.partners.manage' as const;
  readonly mode = 'write' as const;
  constructor(private readonly partners: PartnerRepository) {}
  async execute(input: OperationInputFor<'partner.partners.manage'>, context: WriteHandlerContext<'partner.partners.manage'>): Promise<OperationReply<OperationOutputFor<'partner.partners.manage'>>> {
    const access = requireSession(context.security);
    const body = bodyRecord(input);
    const row = await this.partners.savePartner(context.transaction, {
      id: input.path.partnerid,
      scope: access.scope.id,
      kind: textField(body, 'kind'),
      name: textField(body, 'name'),
      status: body.status === 'suspended' ? 'suspended' : 'active',
      expectedVersion: context.expectedVersion ?? null,
    });
    if (!row) throw new DomainError('VERSION_CONFLICT');
    return { status: 200, body: row as OperationOutputFor<'partner.partners.manage'> };
  }
}
