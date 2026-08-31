import type { OperationRequest, OperationResult } from '../../../../foundation/application/OperationExecution';
import { requireAccess, type OperationDatabase } from '../../../../foundation/application/ModuleOperations';
import type { MemberAccessPort } from '../../../access/public';
import type { CheckoutPort } from '../../CheckoutPort';
import { quoteResult } from '../QuoteResult';
import type { CheckoutRepository } from '../port/CheckoutRepository';
import type { CheckoutPricingPort } from '../../../pricing/public';

export class ReadCurrentQuote {
  constructor(
    private readonly members: MemberAccessPort,
    private readonly checkout: CheckoutPort,
    private readonly repository: CheckoutRepository,
    private readonly pricing: Pick<CheckoutPricingPort, 'quote'>
  ) {}

  async execute(request: OperationRequest, database: OperationDatabase): Promise<OperationResult> {
    const access = requireAccess(request);
    const owner = await this.members.profile(database, access.membership.id);
    const stored = await this.repository.current(database, owner.member, owner.organization);
    if (!stored) return { status: 200, body: { quote: null } };
    const priced = await this.pricing.quote(database, stored.quoteId, owner.member, owner.organization);
    if (priced.signature !== stored.signature) throw new Error('QUOTE_SIGNATURE_BINDING_INVALID');
    const current = Object.freeze({ ...stored, payload: priced.payload });
    const quote = this.checkout.restore(current.payload, current.signature);
    return { status: 200, body: { quote: quoteResult(current, quote) } };
  }
}
