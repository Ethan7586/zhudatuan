import type { ModuleContext } from '../../bootstrap/ModuleRegistry';
import { AUDIT_SINK } from '../../foundation/application/AuditSink';
import { ModuleOperations } from '../../foundation/application/ModuleOperations';
import { DATABASE_POOL } from '../../foundation/persistence/Pool';
import { MEMBER_ACCESS_PORT } from '../access/public';
import { CART_CATALOG_PORT } from '../catalog/public';
import { CART_EXPERIENCE_PORT } from '../experience/public';
import { CART_PRICING_PORT } from '../pricing/public';
import { BatchCartItems } from './application/command/BatchCartItems';
import { PutCartItem } from './application/command/PutCartItem';
import { ReadCurrentCart } from './application/query/ReadCurrentCart';
import { PgCartRepository } from './infrastructure/persistence/PgCartRepository';

export function cartOperations(context: ModuleContext): ModuleOperations {
  const carts = new PgCartRepository();
  const members = context.ports.get(MEMBER_ACCESS_PORT);
  const experience = context.ports.get(CART_EXPERIENCE_PORT);
  const catalog = context.ports.get(CART_CATALOG_PORT);
  const pricing = context.ports.get(CART_PRICING_PORT);
  const read = new ReadCurrentCart(members, experience, carts);
  const put = new PutCartItem(members, experience, catalog, pricing, carts);
  const batch = new BatchCartItems(members, experience, catalog, pricing, carts);
  return new ModuleOperations('cart', context.service(DATABASE_POOL), context.service(AUDIT_SINK), {
    'cart.current.read': (request, database) => read.execute(request, database),
    'cart.items.put': (request, database) => put.execute(request, database),
    'cart.items.batch': (request, database) => batch.execute(request, database),
  });
}
