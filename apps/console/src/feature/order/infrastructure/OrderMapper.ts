import { deepFreeze } from '../../../shared/model/Immutable';
import type { AfterSalePage } from '../model/AfterSale';
import type { OrderAfterSaleDecision, OrderCommandReceipt, OrderDetail, OrderExportTask, OrderImportTask, OrderOperationReceipt, OrderPage, OrderRecoveryPage } from '../model/Order';
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
  OrderRecoveryPageSchema,
  OrderRecoveryResolveSchema,
  OrderRefundSchema,
  OrderReminderSchema,
  OrderReturnInspectSchema,
  OrderReturnReceiveSchema,
  OrderShipmentSchema,
} from './OrderSchema';

import { emptyPayment, orderReturns } from './OrderMapValue';
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
      member_id: detail.summary.memberId,
      member_name: detail.summary.memberName,
      scope_id: detail.summary.scopeId,
      scope_name: detail.summary.scopeName,
      mall_id: detail.summary.mallId,
      mall_name: detail.summary.mallName,
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
