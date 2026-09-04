import { DomainError } from '../../../../foundation/domain/DomainError';
import type { VoucherCustomerPort } from '../../../partner/public';
import type { CheckoutQualificationPort } from '../../../qualification/public';
import type { ProductReference } from '../../application/port/ProductReference';

export class VoucherProductReference implements ProductReference {
  constructor(private readonly customers: VoucherCustomerPort, private readonly qualifications: Pick<CheckoutQualificationPort, 'policies'>) {}

  async validate(context: Parameters<ProductReference['validate']>[0], scope: string, customer: string, qualification: string): Promise<void> {
    const [approved, policies] = await Promise.all([
      this.customers.approved(context, customer, scope),
      this.qualifications.policies(context, scope),
    ]);
    if (!approved || approved.scope !== scope || !policies.some((policy) => policy.id === qualification)) throw new DomainError('VOUCHER_PRODUCT_INCOMPLETE');
  }
}
