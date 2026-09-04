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

export class OrderMapper {
  page(value: unknown): OrderPage {
    return deepFreeze(OrderPageSchema.parse(value));
  }

  order(value: unknown): OrderDetail {
    const detail = OrderDetailSchema.parse(value);
    const payment = detail.payment.state === 'ready' ? detail.payment.data : emptyPayment();
    const fulfillments = detail.fulfillment.state === 'ready' ? detail.fulfillment.data : [];
    const aftersale = detail.aftersale.state === 'ready' ? detail.aftersale.data : undefined;
    const lines = detail.products.state === 'ready' ? detail.products.data : [];
    const timeline = detail.audit.state === 'ready' ? detail.audit.data : [];
    return deepFreeze({
      id: detail.summary.id,
      order_number: detail.summary.orderNumber,
      scope_id: detail.summary.scopeId,
      mall_id: detail.summary.mallId,
      total_minor: detail.summary.totalMinor,
      currency: detail.summary.currency,
      payment_state: detail.summary.paymentState,
      fulfillment_state: detail.summary.fulfillmentState,
      aftersale_state: detail.summary.aftersaleState,
      lifecycle_state: detail.summary.lifecycleState,
      address: detail.summary.address,
      payment,
      fulfillments,
      refunds: aftersale?.refunds ?? [],
      timeline,
      receivedAt: detail.summary.receivedAt,
      created_at: detail.summary.createdAt,
      updated_at: detail.summary.updatedAt,
      version: detail.summary.version,
      lines,
      sourceChannel: detail.summary.sourceChannel,
      externalOrderNo: detail.summary.externalOrderNo,
      sourceState: detail.summary.sourceState,
      verificationState: detail.summary.verificationState,
      orderedAt: detail.summary.orderedAt,
      sections: {
        products: detail.products,
        payment: detail.payment,
        fulfillment: detail.fulfillment,
        aftersale: detail.aftersale,
        finance: detail.finance,
        audit: detail.audit,
      },
    });
  }

  aftersales(value: unknown): AfterSalePage {
    const page = AfterSalePageSchema.parse(value);
    return deepFreeze({
      items: page.items.map((item) => ({ ...item, returns: orderReturns(item.timeline) })),
      count: page.count,
      availableLines: page.availableLines,
      ...(page.nextCursor === undefined ? {} : { nextCursor: page.nextCursor }),
    });
  }

  importTask(value: unknown): OrderImportTask {
    const task = OrderImportSchema.parse(value);
    return deepFreeze({ id: task.id, state: task.state, totalCount: task.total_count, successCount: task.success_count, failureCount: task.failure_count, createdAt: task.created_at, updatedAt: task.updated_at });
  }

  exportTask(value: unknown): OrderExportTask {
    const task = OrderExportSchema.parse(value);
    return deepFreeze({ id: task.id, state: task.state, watermark: task.watermark, createdAt: task.createdAt });
  }

  received(value: unknown): OrderCommandReceipt {
    const receipt = OrderReceiveSchema.parse(value);
    return deepFreeze({ id: String(receipt.eventId), orderId: String(receipt.orderId), state: receipt.fulfillmentState, version: receipt.version, occurredAt: receipt.receivedAt });
  }

  cancelled(value: unknown): OrderCommandReceipt {
    const receipt = OrderCancelSchema.parse(value);
    return deepFreeze({ id: String(receipt.eventId), orderId: String(receipt.orderId), state: receipt.lifecycleState, version: receipt.version, occurredAt: receipt.cancelledAt });
  }

  reminder(value: unknown): OrderCommandReceipt {
    const receipt = OrderReminderSchema.parse(value);
    return deepFreeze({ id: receipt.id, orderId: receipt.order_id, state: receipt.state, occurredAt: receipt.created_at });
  }

  aftersale(value: unknown, decision: OrderAfterSaleDecision): OrderCommandReceipt {
    const receipt = decision === 'approve' ? OrderAftersaleApproveSchema.parse(value) : OrderAftersaleRejectSchema.parse(value);
    return deepFreeze({ id: receipt.id, orderId: receipt.orderId, state: receipt.state, version: receipt.version, occurredAt: receipt.updatedAt });
  }

  recoveries(value: unknown): OrderRecoveryPage {
    const page = OrderRecoveryPageSchema.parse(value);
    return deepFreeze({
      items: page.items.map((item) => ({
        id: item.id,
        orderId: item.order_id,
        orderNumber: item.order_number,
        resourceType: item.resource_type,
        resourceId: item.resource_id,
        severity: item.severity,
        state: item.state,
        errorCode: item.error_code,
        occurrenceCount: item.occurrence_count,
        openedAt: item.opened_at,
        resolvedAt: item.resolved_at,
        resolutionRequestId: item.resolution_request_id,
        version: item.version,
      })),
      count: page.count,
      ...(page.nextCursor === undefined ? {} : { nextCursor: page.nextCursor }),
    });
  }

  shipment(value: unknown): OrderOperationReceipt {
    const receipt = OrderShipmentSchema.parse(value);
    return deepFreeze({ id: receipt.id, state: receipt.state, version: receipt.version });
  }

  returned(value: unknown, inspection: boolean): OrderOperationReceipt {
    const receipt = inspection ? OrderReturnInspectSchema.parse(value) : OrderReturnReceiveSchema.parse(value);
    return deepFreeze({ id: receipt.id, state: receipt.state, version: receipt.version });
  }

  refund(value: unknown): OrderOperationReceipt {
    const receipt = OrderRefundSchema.parse(value);
    return deepFreeze({ id: receipt.id, state: receipt.state });
  }

  recovery(value: unknown): OrderOperationReceipt {
    const receipt = OrderRecoveryResolveSchema.parse(value);
    return deepFreeze({ id: receipt.case, state: receipt.state, requestId: receipt.request });
  }
}

function emptyPayment() {
  return Object.freeze({ paymentId: null, version: 0, capturedMinor: 0, refundedMinor: 0, refundableMinor: 0, updatedAt: null, tenders: Object.freeze([]) });
}

function orderReturns(timeline: readonly Readonly<{ evidence: unknown }>[]) {
  const latest = new Map<string, OrderReturn>();
  for (const entry of timeline) {
    const evidence = record(entry.evidence);
    const values = Array.isArray(evidence?.returns) ? evidence.returns : [];
    for (const value of values) {
      const item = record(value);
      if (!item || typeof item.id !== 'string' || !returnState(item.state) || !Number.isSafeInteger(item.version)) continue;
      latest.set(item.id, Object.freeze({
        id: item.id,
        state: item.state,
        provider: typeof item.provider === 'string' ? item.provider : null,
        providerReferenceMasked: masked(item.providerReference),
        trackingMasked: masked(item.trackingNumber),
        version: Number(item.version),
      }));
    }
  }
  return Object.freeze([...latest.values()].sort((left, right) => left.id.localeCompare(right.id)));
}

function record(value: unknown): Readonly<Record<string, unknown>> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Readonly<Record<string, unknown>> : null;
}

function returnState(value: unknown): value is OrderReturn['state'] {
  return typeof value === 'string' && (FULFILLMENT_RETURN_STATES as readonly string[]).includes(value);
}

function masked(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? `尾号 ${value.slice(-4)}` : null;
}
