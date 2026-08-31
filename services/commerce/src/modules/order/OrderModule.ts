import { defineModule } from '../../bootstrap/DefinedModule';
import { orderOperations } from './OrderOperations';
import { Manifest } from './Manifest';
import { OrderPort } from './OrderPort';
import { GetOrderSummary } from './application/GetOrderSummary';
import { CHECKOUT_ORDER_PORT, FULFILLMENT_ORDER_PORT, ORDER_RECEIPT_PORT, PAYMENT_ORDER_PORT, PgOrderReceiptPort, SUPPORT_ORDER_PORT } from './public/index';
import { DATABASE_POOL } from '../../foundation/persistence/Pool';
import { ORDER_READ_PORT, PgOrderReadPort } from './public/OrderReadPort';
import { readDatabaseWorkload, writeDatabaseWorkload } from '../../foundation/persistence/Workload';
export const OrderModule = defineModule(Manifest, orderOperations, (context) => {
  const order = new OrderPort();
  return [
    { token: CHECKOUT_ORDER_PORT, value: order },
    { token: PAYMENT_ORDER_PORT, value: order },
    { token: FULFILLMENT_ORDER_PORT, value: order },
    { token: SUPPORT_ORDER_PORT, value: new GetOrderSummary() },
    { token: ORDER_RECEIPT_PORT, value: new PgOrderReceiptPort(context.service(DATABASE_POOL), writeDatabaseWorkload(context.workload)) },
    { token: ORDER_READ_PORT, value: new PgOrderReadPort(context.service(DATABASE_POOL), readDatabaseWorkload(context.workload)) },
  ];
});
