import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import { DomainError } from '../../../../foundation/domain/DomainError';
import { bodyRecord, integerField } from '../../../../foundation/interface/Validation';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
import type { ReferralCatalogPort } from '../../../catalog/public';
import { ReferralProduct } from '../../domain/model/ReferralProduct';
import type { ReferralRepository } from '../port/ReferralRepository';

export class ProductsManageHandler implements OperationHandler<'referral.products.manage', 'write'> {
  readonly operation = 'referral.products.manage' as const;
  readonly mode = 'write' as const;
  constructor(
    private readonly referrals: ReferralRepository,
    private readonly catalog: ReferralCatalogPort
  ) {}
  async execute(input: OperationInputFor<'referral.products.manage'>, context: WriteHandlerContext<'referral.products.manage'>): Promise<OperationReply<OperationOutputFor<'referral.products.manage'>>> {
    const access = requireSession(context.security);
    const body = bodyRecord(input);
    const product = input.path.productid;
    const source = await this.catalog.product(access.scope.id, product);
    if (!source?.active) throw new DomainError('REFERRAL_PRODUCT_DISABLED');
    const model = new ReferralProduct(product, access.scope.id, product, booleanField(body, 'enabled'), integerField(body, 'rateBasisPoints'), expected(context.expectedVersion));
    const result = await this.referrals.manageProduct(context.transaction, {
      id: model.id,
      scopeId: model.scopeId,
      productId: model.productId,
      enabled: model.enabled,
      rateBasisPoints: model.rate.basisPoints,
      expectedVersion: model.version,
    });
    return { status: 200, body: result as OperationOutputFor<'referral.products.manage'> };
  }
}

function expected(value: number | undefined): number {
  if (!Number.isSafeInteger(value) || value! < 1) throw new DomainError('VERSION_CONFLICT');
  return value!;
}
function booleanField(body: Readonly<Record<string, unknown>>, field: string): boolean {
  if (typeof body[field] !== 'boolean') throw new DomainError('VALIDATION_FAILED', { field });
  return body[field] as boolean;
}
