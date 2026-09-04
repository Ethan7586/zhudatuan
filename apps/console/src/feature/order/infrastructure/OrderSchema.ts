import * as z from 'zod/mini';
import { exactOperationOutput } from '@shop/contract/schema';

export const OrderPageSchema = exactOperationOutput('OrderOrdersReadOutput').check(
  z.refine((page) => page.items.length <= 50, { message: 'ORDER_PAGE_LIMIT_EXCEEDED' }),
  z.refine((page) => page.count === page.items.length, { message: 'ORDER_PAGE_COUNT_MISMATCH' })
);
export const OrderDetailSchema = exactOperationOutput('OrderDetailReadOutput');
export const OrderImportSchema = exactOperationOutput('OrderImportsCreateOutput');
export const OrderExportSchema = exactOperationOutput('OrderOrdersExportOutput');
export const OrderReceiveSchema = exactOperationOutput('OrderOrdersReceiveOutput');
export const OrderCancelSchema = exactOperationOutput('OrderOrdersCancelOutput');
export const OrderReminderSchema = exactOperationOutput('OrderRemindersCreateOutput');
export const OrderAftersaleApproveSchema = exactOperationOutput('OrderAftersalesApproveOutput');
export const OrderAftersaleRejectSchema = exactOperationOutput('OrderAftersalesRejectOutput');
export const OrderShipmentSchema = exactOperationOutput('FulfillmentShipmentsCreateOutput');
export const OrderReturnReceiveSchema = exactOperationOutput('FulfillmentReturnsReceiveOutput');
export const OrderReturnInspectSchema = exactOperationOutput('FulfillmentReturnsInspectOutput');
export const OrderRefundSchema = exactOperationOutput('PaymentRefundsRequestOutput');
export const OrderRecoveryPageSchema = exactOperationOutput('PaymentRecoveriesReadOutput');
export const OrderRecoveryResolveSchema = exactOperationOutput('PaymentRecoveriesResolveOutput');
