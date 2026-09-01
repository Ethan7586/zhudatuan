import type { OperationRequest, OperationResult } from '../../../../foundation/application/OperationRequest';
import { requireAccess } from '../../../../foundation/application/OperationAccess';
import type { ReadTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { MemberAccessPort } from '../../../access/public';
import type { CheckoutPort } from '../../application/service/CheckoutPort';
import { quoteResult } from '../../application/service/QuoteResult';
import type { CheckoutSessionStore } from '../../application/port/CheckoutSessionStore';
import type { CheckoutPricingPort } from '../../../pricing/public';

export class CurrentQuoteReader {
  constructor(
    private readonly members: MemberAccessPort,
    private readonly checkout: CheckoutPort,
    private readonly repository: CheckoutSessionStore,
    private readonly pricing: Pick<CheckoutPricingPort, 'quote'>
  ) {}

  async execute(request: OperationRequest, context: ReadTransactionContext): Promise<OperationResult> {
    const access = requireAccess(request);
    const owner = await this.members.profile(context, access.membership.id);
    const stored = await this.repository.current(context, owner.member, owner.organization);
    if (!stored) return { status: 200, body: { quote: null } };
    const priced = await this.pricing.quote(context, stored.quoteId, owner.member, owner.organization);
    if (priced.signature !== stored.signature) throw new Error('QUOTE_SIGNATURE_BINDING_INVALID');
    const current = Object.freeze({ ...stored, payload: priced.payload });
    const quote = this.checkout.restore(current.payload, current.signature);
    return { status: 200, body: { quote: quoteResult(current, quote) } };
  }
}
