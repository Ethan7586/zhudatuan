import type { WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import type { BenefitGateway } from '../../../benefit/public';
import type { CheckoutInventoryPort } from '../../../inventory/public';
import type { MarketingReservePort } from '../../../marketing/public';
import type { PaymentHoldReleasePort } from '../../../payment/public';
import type { CheckoutQuote } from '../../domain/model/CheckoutQuote';
import { byReference, integer, text } from '../../domain/policy/ConfirmQuotePolicy';

export interface VoucherHoldPort {
  reserve(context: WriteTransactionContext, order: string, member: string, scope: string, tenders: readonly Readonly<{ reference: string; amountMinor: number }>[]): Promise<void>;
}

export class CheckoutReservations {
  constructor(
    private readonly inventory: CheckoutInventoryPort,
    private readonly voucher: VoucherHoldPort,
    private readonly marketing: MarketingReservePort,
    private readonly benefit: Pick<BenefitGateway, 'reserve'>,
    private readonly holds: PaymentHoldReleasePort
  ) {}

  inventoryHold(context: WriteTransactionContext, order: string, quote: CheckoutQuote): Promise<void> {
    return this.inventory.reserve(context, order, quote.cart.mall, quote.lines);
  }

  voucherHold(context: WriteTransactionContext, order: string, quote: CheckoutQuote): Promise<void> {
    const tenders = quote.tenders.filter((item) => item.kind === 'voucher').sort(byReference);
    return this.voucher.reserve(
      context,
      order,
      quote.cart.member,
      quote.cart.mall,
      tenders.map(({ reference, amountMinor }) => ({ reference: reference!, amountMinor }))
    );
  }

  async marketingHold(context: WriteTransactionContext, order: string, quote: CheckoutQuote, expiresAt: string): Promise<void> {
    const values = Array.isArray(quote.evidence.marketing) ? (quote.evidence.marketing as readonly Readonly<Record<string, unknown>>[]) : [];
    for (const value of [...values].sort((left, right) => String(left.id).localeCompare(String(right.id)))) {
      await this.marketing.reserve(context, {
        campaign: text(value.id, 'campaign'),
        campaignVersion: integer(value.version, 'campaign.version'),
        member: quote.cart.member,
        order,
        scope: quote.cart.mall,
        amountMinor: integer(value.discount, 'campaign.discount'),
        expiresAt,
      });
    }
  }

  benefitHold(context: WriteTransactionContext, order: string, quote: CheckoutQuote): Promise<void> {
    const tenders = quote.tenders.filter((item) => item.kind === 'benefit').sort(byReference);
    return this.benefit.reserve(
      context,
      order,
      quote.cart.member,
      quote.cart.mall,
      tenders.map(({ reference, amountMinor }) => ({ reference: reference!, amountMinor }))
    );
  }

  release(context: WriteTransactionContext, order: string): Promise<void> {
    return this.holds.release(context, order);
  }
}
