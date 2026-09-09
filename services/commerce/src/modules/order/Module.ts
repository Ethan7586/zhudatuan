import { PgOrderReceiptPort } from './infrastructure/persistence/PgOrderReceiptPort';
import { PgOrderReadPort } from './infrastructure/persistence/PgOrderReadPort';
import { PgFinanceOrderPort } from './infrastructure/persistence/PgFinanceOrderPort';

import { PgTransactionAccess } from '../../platform/database/PgTransactionAccess';
import { PgOutbox } from '../../platform/database/PgOutbox';
import { PgTransactionManager } from '../../platform/database/PgTransactionManager';
import { defineModule } from '../../composition/DefinedModule';
import { OBJECT_STORE } from '../runtime/public/ObjectPort';
import { Manifest } from './Manifest';
import { AfterSalesApplyHandler } from './application/handler/AfterSalesApplyHandler';
import { AfterSaleAttachmentsCreateHandler } from './application/handler/AfterSaleAttachmentsCreateHandler';
import { AfterSalesApproveHandler } from './application/handler/AfterSalesApproveHandler';
import { AfterSalesReadHandler } from './application/handler/AfterSalesReadHandler';
import { AfterSalesRejectHandler } from './application/handler/AfterSalesRejectHandler';
import { OrdersExportHandler } from './application/handler/OrdersExportHandler';
import { OrdersReadHandler } from './application/handler/OrdersReadHandler';
import { OrderDetailReadHandler } from './application/handler/OrderDetailReadHandler';
import { ImportsCreateHandler } from './application/handler/ImportsCreateHandler';
import { ImportsReadHandler } from './application/handler/ImportsReadHandler';
import { OrdersReceiveHandler } from './application/handler/OrdersReceiveHandler';
import { OrdersCancelHandler } from './application/handler/OrdersCancelHandler';
import { RemindersCreateHandler } from './application/handler/RemindersCreateHandler';
import { AfterSaleAttachment } from './application/service/AfterSaleAttachment';
import { OrderPort } from './infrastructure/persistence/OrderPort';
import { PgOrderSupportPort } from './infrastructure/persistence/PgOrderSupportPort';
import { FINANCE_ORDER_PORT, ORDER_EXPIRY_PORT, ORDER_FULFILLMENT_PORT, ORDER_INTENT_PORT, ORDER_PAYMENT_JOB_PORT, ORDER_PAYMENT_PORT, ORDER_RECEIPT_PORT, SUPPORT_ORDER_PORT } from './public/index';
import { DATABASE_POOL } from '../../platform/database/Pool';
import { ORDER_READ_PORT } from './public/OrderReadPort';
import { writeDatabaseWorkload } from '../../platform/database/Workload';
import { ORGANIZATION_READ_PORT } from '../organization/public';
import { AFTERSALE_POLICY_PORT } from '../qualification/public';
import { PgAfterSaleRepository } from './infrastructure/persistence/PgAfterSaleRepository';
import { PgOrderRepository } from './infrastructure/persistence/PgOrderRepository';
import { AUDIT_READ_PORT } from '../audit/public';
import { PgOrderDetailRepository } from './infrastructure/persistence/PgOrderDetailRepository';
import { MEMBER_READ_PORT } from '../member/public';
import { CATALOG_PARTNER_PORT } from '../partner/public';
import { ASSET_PORT, IMPORT_OBJECT_PORT, RUNTIME_IMPORT_PORT } from '../runtime/public';
import { PgJobScheduler } from '../../platform/database/PgJobScheduler';
import { createJobs } from './interface/job/JobFactory';
import { EVENT_SUBSCRIPTIONS } from '../../generated/EventSubscriptions';
import { OrderLabels } from './application/service/OrderLabels';
import { OrderMedia } from './application/service/OrderMedia';

export const OrderModule = defineModule(Manifest, {
  events: [{ handler: 'orderevent', events: EVENT_SUBSCRIPTIONS.orderevent }],
  jobs: createJobs,
  handlers: (context) => {
    const transactions = new PgTransactionAccess();
    const members = context.ports.get(MEMBER_READ_PORT);
    const organizations = context.ports.get(ORGANIZATION_READ_PORT);
    const partners = context.ports.get(CATALOG_PARTNER_PORT);
    const labels = new OrderLabels(members, organizations, partners);
    const media = new OrderMedia(context.ports.get(ASSET_PORT));
    const repository = new PgOrderRepository(transactions, new PgOutbox(new PgTransactionManager(context.service(DATABASE_POOL))), organizations, members, partners, media);
    const aftersales = new PgAfterSaleRepository(transactions, context.ports.get(AFTERSALE_POLICY_PORT), organizations, members);
    const attachmentService = new AfterSaleAttachment(context.service(OBJECT_STORE));
    const audit = context.ports.get(AUDIT_READ_PORT);
    return [
      new OrdersReadHandler(repository),
      new OrderDetailReadHandler(new PgOrderDetailRepository(transactions, organizations, media), audit, labels),
      new ImportsCreateHandler(context.ports.get(RUNTIME_IMPORT_PORT), new PgJobScheduler(transactions), context.ports.get(IMPORT_OBJECT_PORT)),
      new ImportsReadHandler(context.ports.get(RUNTIME_IMPORT_PORT), context.service(OBJECT_STORE)),
      new RemindersCreateHandler(repository),
      new OrdersExportHandler(repository),
      new OrdersCancelHandler(repository),
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
      { token: ORDER_INTENT_PORT, value: order },
      { token: ORDER_PAYMENT_PORT, value: order },
      { token: ORDER_FULFILLMENT_PORT, value: order },
      { token: SUPPORT_ORDER_PORT, value: new PgOrderSupportPort() },
      { token: ORDER_RECEIPT_PORT, value: new PgOrderReceiptPort(context.service(DATABASE_POOL), writeDatabaseWorkload(context.workload)) },
      { token: ORDER_READ_PORT, value: new PgOrderReadPort(new PgTransactionManager(context.service(DATABASE_POOL))) },
      { token: FINANCE_ORDER_PORT, value: new PgFinanceOrderPort() },
    ];
  },
  jobPorts: () => {
    const order = new OrderPort();
    return [
      { token: ORDER_EXPIRY_PORT, value: order },
      { token: ORDER_PAYMENT_JOB_PORT, value: order },
      { token: ORDER_FULFILLMENT_PORT, value: order },
      { token: FINANCE_ORDER_PORT, value: new PgFinanceOrderPort() },
    ];
  },
  providerPorts: [{ token: ORDER_FULFILLMENT_PORT, value: new OrderPort() }],
});
