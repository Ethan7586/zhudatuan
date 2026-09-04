import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import { DomainError } from '../../../../foundation/domain/DomainError';
import type { WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import { bodyRecord, textField } from '../../../../foundation/application/Validation';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
import { Partner } from '../../domain/model/Partner';
import type { PartnerRepository } from '../port/PartnerRepository';
const KINDS = new Set(['supplier', 'brand']);
const STATES = new Set(['pending', 'active', 'suspended', 'terminated']);
export class PartnersManageHandler implements OperationHandler<'partner.partners.manage', 'write'> {
  readonly operation = 'partner.partners.manage' as const;
  readonly mode = 'write' as const;
  constructor(private readonly partners: PartnerRepository) {}
  async execute(input: OperationInputFor<'partner.partners.manage'>, context: WriteHandlerContext<'partner.partners.manage'>): Promise<OperationReply<OperationOutputFor<'partner.partners.manage'>>> {
    const access = requireSession(context.security);
    const body = bodyRecord(input);
    const kind = textField(body, 'kind', 16);
    const status = body.status === undefined ? 'pending' : textField(body, 'status', 16);
    if (!KINDS.has(kind) || !STATES.has(status)) throw new DomainError('VALIDATION_FAILED');
    const partner = new Partner(input.path.partnerid, status as 'pending' | 'active' | 'suspended' | 'terminated');
    const row = await this.partners.savePartner(context.transaction, {
      id: partner.id,
      scope: access.scope.id,
      kind: kind as 'supplier' | 'brand',
      name: textField(body, 'name', 160),
      status: status as 'pending' | 'active' | 'suspended' | 'terminated',
      expectedVersion: context.expectedVersion ?? null,
    });
    if (!row) throw new DomainError('VERSION_CONFLICT');
    return { status: 200, body: row as OperationOutputFor<'partner.partners.manage'> };
  }
}
