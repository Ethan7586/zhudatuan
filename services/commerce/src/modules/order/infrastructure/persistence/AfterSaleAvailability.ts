import type { SqlExecutor } from '../../../../platform/database/PgTransactionAccess';
import type { AfterSalePolicyPort } from '../../../qualification/public';
import type { AftersaleState, CommerceState, FulfillmentState, PaymentState } from '../../domain/model/Order';
import { AfterSaleRefundPolicy } from '../../domain/policy/AfterSaleRefundPolicy';

export interface OrderRow {
  readonly id: string;
  readonly scope_id: string;
  readonly member_id: string;
  readonly currency: string;
  readonly lifecycle_state: CommerceState;
  readonly payment_state: PaymentState;
  readonly fulfillment_state: FulfillmentState;
  readonly aftersale_state: AftersaleState;
  readonly evidence: Record<string, unknown>;
}

export interface LineRow {
  readonly id: string;
  readonly sku_id: string;
  readonly listing_id: string;
  readonly title_snapshot: string;
  readonly quantity: number;
  readonly fulfilled_quantity: number;
  readonly aftersale_quantity: number;
  readonly payable_minor: number;
  readonly provider: string | null;
  readonly product_type: string;
  readonly fulfilled_at: string | null;
  readonly provider_rule: Record<string, unknown>;
}

export async function availableAfterSaleLines(database: SqlExecutor, order: OrderRow, lines: readonly LineRow[], policies: AfterSalePolicyPort): Promise<readonly Record<string, unknown>[]> {
  const refunds = new AfterSaleRefundPolicy();
  const result: Record<string, unknown>[] = [];
  for (const line of lines) {
    const decision = await policies.evaluate(database.transaction, {
      scope: order.scope_id,
      member: order.member_id,
      line: line.id,
      productType: line.product_type,
      provider: line.provider,
      fulfilledAt: line.fulfilled_at,
      fulfilledQuantity: line.fulfilled_quantity,
      claimedQuantity: line.aftersale_quantity,
      requestedQuantity: 1,
      providerRule: line.provider_rule,
    });
    result.push(
      Object.freeze({
        lineId: line.id,
        skuId: line.sku_id,
        listingId: line.listing_id,
        title: line.title_snapshot,
        productType: line.product_type,
        provider: line.provider,
        purchasedQuantity: line.quantity,
        fulfilledQuantity: line.fulfilled_quantity,
        claimedQuantity: line.aftersale_quantity,
        maximumQuantity: decision.maximumQuantity,
        expectedRefundMinor: decision.maximumQuantity > 0 ? refunds.prorate(line.payable_minor, line.quantity, decision.maximumQuantity) : 0,
        available: decision.eligible,
        unavailableReason: decision.unavailableReason,
        deadline: decision.deadline,
        requiresReturn: decision.requiresReturn,
      })
    );
  }
  return Object.freeze(result);
}
