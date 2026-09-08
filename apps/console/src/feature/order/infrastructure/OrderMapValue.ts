import type { AfterSalePage } from '../model/AfterSale';
import type { OrderAfterSaleDecision, OrderCommandReceipt, OrderDetail, OrderExportTask, OrderImportTask, OrderOperationReceipt, OrderPage, OrderRecoveryPage, OrderReturn } from '../model/Order';
import { FULFILLMENT_RETURN_STATES } from '@shop/contract';
import { deepFreeze } from '../../../shared/model/Immutable';
import { AfterSalePageSchema } from './AfterSaleSchema';
import {
  OrderAftersaleApproveSchema,
  OrderAftersaleRejectSchema,
  OrderCancelSchema,
  OrderDetailSchema,
  OrderExportSchema,
  OrderImportSchema,
  OrderPageSchema,
  OrderReceiveSchema,
  OrderReminderSchema,
  OrderShipmentSchema,
  OrderReturnReceiveSchema,
  OrderReturnInspectSchema,
  OrderRefundSchema,
  OrderRecoveryPageSchema,
  OrderRecoveryResolveSchema,
} from './OrderSchema';

export function emptyPayment() {
  return Object.freeze({ paymentId: null, version: 0, capturedMinor: 0, refundedMinor: 0, refundableMinor: 0, updatedAt: null, tenders: Object.freeze([]) });
}

export function orderReturns(timeline: readonly Readonly<{ evidence: unknown }>[]) {
  const latest = new Map<string, OrderReturn>();
  for (const entry of timeline) {
    const evidence = record(entry.evidence);
    const values = Array.isArray(evidence?.returns) ? evidence.returns : [];
    for (const value of values) {
      const item = record(value);
      if (!item || typeof item.id !== 'string' || !returnState(item.state) || !Number.isSafeInteger(item.version)) continue;
      latest.set(
        item.id,
        Object.freeze({
          id: item.id,
          state: item.state,
          provider: typeof item.provider === 'string' ? item.provider : null,
          providerReferenceMasked: masked(item.providerReference),
          trackingMasked: masked(item.trackingNumber),
          version: Number(item.version),
        })
      );
    }
  }
  return Object.freeze([...latest.values()].sort((left, right) => left.id.localeCompare(right.id)));
}

export function record(value: unknown): Readonly<Record<string, unknown>> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Readonly<Record<string, unknown>>) : null;
}

export function returnState(value: unknown): value is OrderReturn['state'] {
  return typeof value === 'string' && (FULFILLMENT_RETURN_STATES as readonly string[]).includes(value);
}

export function masked(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? `尾号 ${value.slice(-4)}` : null;
}
