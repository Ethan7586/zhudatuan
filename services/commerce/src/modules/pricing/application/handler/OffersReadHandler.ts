import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import { latestWatermark } from '../../../../pipeline/Watermark';
import { queryIdentifiers } from '../../../../pipeline/Validation';
import { requireSession } from '../../../../platform/security/OperationSecurityContext';
import type { PricingReadPort } from '../../public/PricingReadPort';

export class OffersReadHandler implements OperationHandler<'pricing.offers.read', 'read'> {
  readonly operation = 'pricing.offers.read' as const;
  readonly mode = 'read' as const;

  constructor(private readonly pricing: PricingReadPort) {}

  async execute(input: OperationInputFor<'pricing.offers.read'>, context: HandlerContext<'pricing.offers.read'>): Promise<OperationReply<OperationOutputFor<'pricing.offers.read'>>> {
    const access = requireSession(context.security);
    const items = await this.pricing.offers(context.transaction, access.scope.id, queryIdentifiers(input, 'sku'));
    return {
      status: 200,
      body: {
        items: items.map((item) => ({
          sku: item.sku,
          scope: item.scope,
          amountMinor: item.amountMinor,
          compareMinor: item.compareMinor,
          currency: item.currency,
          breakdown: item.breakdown.map((component) => ({ ...component })),
          status: item.status,
          effectiveAt: item.effectiveAt,
          expiresAt: item.expiresAt,
          version: item.version,
          watermark: item.watermark,
        })),
        count: items.length,
        watermark: latestWatermark(items.map(({ watermark }) => watermark)),
      },
    };
  }
}
