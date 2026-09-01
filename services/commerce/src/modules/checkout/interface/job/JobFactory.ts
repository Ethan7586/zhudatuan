import { PgTransactionManager } from '../../../../adapter/database/PgTransactionManager';
import type { ModuleContext } from '../../../../bootstrap/ModuleRegistry';
import type { ModuleJob } from '../../../../foundation/application/ModuleJob';
import { DATABASE_POOL } from '../../../../foundation/persistence/Pool';
import { ORDER_EXPIRY_INVENTORY_PORT } from '../../../inventory/public';
import { ORDER_EXPIRY_ORDER_PORT } from '../../../order/public';
import { ORDER_EXPIRY_HOLD_PORT, ORDER_EXPIRY_PAYMENT_PORT } from '../../../payment/public';
import { ExpireOrders } from '../../application/process/ExpireOrders';
import { PgCheckoutSessionStore } from '../../infrastructure/persistence/PgCheckoutSessionStore';
import { PgOrderExpiryRepository } from '../../infrastructure/persistence/PgOrderExpiryRepository';
import { OrderExpiryJob } from './OrderExpiryJob';

export function createJobs(context: ModuleContext): readonly ModuleJob[] {
  return Object.freeze([
    {
      id: 'orderexpiry',
      processor: new OrderExpiryJob(
        new ExpireOrders(new PgTransactionManager(context.service(DATABASE_POOL)), new PgOrderExpiryRepository(), {
          payments: context.ports.get(ORDER_EXPIRY_PAYMENT_PORT),
          checkouts: new PgCheckoutSessionStore(),
          inventory: context.ports.get(ORDER_EXPIRY_INVENTORY_PORT),
          orders: context.ports.get(ORDER_EXPIRY_ORDER_PORT),
          holds: context.ports.get(ORDER_EXPIRY_HOLD_PORT),
        })
      ),
    },
  ]);
}
