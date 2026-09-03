import { PgOrderReceiptPort } from './infrastructure/persistence/PgOrderReceiptPort';
import { PgOrderReadPort } from './infrastructure/persistence/PgOrderReadPort';
import { ResolvePaymentWebhookScope } from './application/service/ResolvePaymentWebhookScope';
import { PgPaymentWebhookScopeReader } from './infrastructure/persistence/PgPaymentWebhookScopeReader';

import { PgTransactionAccess } from '../../adapter/database/PgTransactionAccess';
import { PgOutbox } from '../../adapter/database/PgOutbox';
import { PgTransactionManager } from '../../adapter/database/PgTransactionManager';
import { defineModule } from '../../bootstrap/DefinedModule';
import { OBJECT_STORE } from '../../foundation/infrastructure/ObjectStore';
import { Manifest } from './Manifest';
import { AfterSalesApplyHandler } from './application/handler/AfterSalesApplyHandler';
import { AfterSaleAttachmentsCreateHandler } from './application/handler/AfterSaleAttachmentsCreateHandler';
import { AfterSalesApproveHandler } from './application/handler/AfterSalesApproveHandler';
import { AfterSalesReadHandler } from './application/handler/AfterSalesReadHandler';
import { AfterSalesRejectHandler } from './application/handler/AfterSalesRejectHandler';
import { OrdersExportHandler } from './application/handler/OrdersExportHandler';
import { OrdersReadHandler } from './application/handler/OrdersReadHandler';
import { OrdersReceiveHandler } from './application/handler/OrdersReceiveHandler';
import { RemindersCreateHandler } from './application/handler/RemindersCreateHandler';
import { AfterSaleAttachmentService } from './application/service/AfterSaleAttachmentService';
import { OrderPort } from './infrastructure/persistence/OrderPort';
import { GetOrderSummary } from './application/service/GetOrderSummary';
import { PgOrderSummaryRepository } from './infrastructure/persistence/PgOrderSummaryRepository';
import { CHECKOUT_ORDER_PORT, FULFILLMENT_ORDER_PORT, ORDER_EXPIRY_ORDER_PORT, ORDER_RECEIPT_PORT, PAYMENT_JOB_ORDER_PORT, PAYMENT_ORDER_PORT, PAYMENT_WEBHOOK_ORDER_PORT, SUPPORT_ORDER_PORT } from './public/index';
import { DATABASE_POOL } from '../../foundation/persistence/Pool';
import { ORDER_READ_PORT } from './public/OrderReadPort';
import { writeDatabaseWorkload } from '../../foundation/persistence/Workload';
import { ORGANIZATION_READ_PORT } from '../organization/public';
import { AFTERSALE_POLICY_PORT } from '../qualification/public';
import { PgAfterSaleRepository } from './infrastructure/persistence/PgAfterSaleRepository';
import { PgOrderRepository } from './infrastructure/persistence/PgOrderRepository';
import { ORDER_AUDIT_READ_PORT } from '../audit/public';

export const OrderModule = defineModule(Manifest, {
  handlers: (context) => {
    const transactions = new PgTransactionAccess();
    const repository = new PgOrderRepository(transactions, new PgOutbox(new PgTransactionManager(context.service(DATABASE_POOL))), context.ports.get(ORGANIZATION_READ_PORT));
    const aftersales = new PgAfterSaleRepository(transactions, context.ports.get(AFTERSALE_POLICY_PORT), context.ports.get(ORGANIZATION_READ_PORT));
    const attachmentService = new AfterSaleAttachmentService(context.service(OBJECT_STORE));
    return [
      new OrdersReadHandler(repository, context.ports.get(ORDER_AUDIT_READ_PORT)),
      new RemindersCreateHandler(repository),
      new OrdersExportHandler(repository),
      new OrdersReceiveHandler(repository),
      new AfterSalesReadHandler(aftersales),
      new AfterSaleAttachmentsCreateHandler(attachmentService),
      new AfterSalesApplyHandler(aftersales, attachmentService),
      new AfterSalesApproveHandler(aftersales),
      new AfterSalesRejectHandler(aftersales),
    ];
  },
  ports: (context) => {
    const order = new OrderPort();
    return [
      { token: CHECKOUT_ORDER_PORT, value: order },
      { token: PAYMENT_ORDER_PORT, value: order },
      { token: FULFILLMENT_ORDER_PORT, value: order },
      { token: SUPPORT_ORDER_PORT, value: new GetOrderSummary(new PgOrderSummaryRepository()) },
      { token: ORDER_RECEIPT_PORT, value: new PgOrderReceiptPort(context.service(DATABASE_POOL), writeDatabaseWorkload(context.workload)) },
      { token: ORDER_READ_PORT, value: new PgOrderReadPort() },
      { token: PAYMENT_WEBHOOK_ORDER_PORT, value: new ResolvePaymentWebhookScope(new PgPaymentWebhookScopeReader(new PgTransactionManager(context.service(DATABASE_POOL)))) },
    ];
  },
  jobPorts: () => {
    const order = new OrderPort();
    return [
      { token: ORDER_EXPIRY_ORDER_PORT, value: order },
      { token: PAYMENT_JOB_ORDER_PORT, value: order },
    ];
  },
  providerPorts: [{ token: FULFILLMENT_ORDER_PORT, value: new OrderPort() }],
});
