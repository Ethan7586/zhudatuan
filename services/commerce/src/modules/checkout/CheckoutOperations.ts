import type { ModuleContext } from '../../bootstrap/ModuleRegistry';
import { PgOutbox } from '../../adapter/database/PgOutbox';
import { AUDIT_SINK } from '../../foundation/application/AuditSink';
import { ModuleOperations, operationLifecycle } from '../../foundation/application/ModuleOperations';
import { SystemClock } from '../../foundation/domain/Clock';
import { SECURITY_KEYS } from '../../foundation/infrastructure/SecretStore';
import { DATABASE_POOL } from '../../foundation/persistence/Pool';
import { MEMBER_ACCESS_PORT } from '../access/public';
import { CHECKOUT_BENEFIT_PORT } from '../benefit/public';
import { CART_READ_PORT, CHECKOUT_CART_PORT } from '../cart/public';
import { CHECKOUT_CATALOG_PORT } from '../catalog/public';
import { CHECKOUT_EXPERIENCE_PORT } from '../experience/public';
import { CHECKOUT_INVOICE_PORT } from '../finance/public';
import { CHECKOUT_INVENTORY_PORT } from '../inventory/public';
import { CHECKOUT_MARKETING_PORT } from '../marketing/public';
import { CHECKOUT_ORDER_PORT } from '../order/public';
import { ORGANIZATION_READ_PORT } from '../organization/public';
import { CHECKOUT_PAYMENT_PORT } from '../payment/public';
import { CHECKOUT_PRICING_PORT } from '../pricing/public';
import { CHECKOUT_QUALIFICATION_PORT } from '../qualification/public';
import { CHECKOUT_RISK_PORT } from '../risk/public';
import { CHECKOUT_VOUCHER_PORT } from '../voucher/public';
import { AddressPort } from './AddressPort';
import { CheckoutPort } from './CheckoutPort';
import { QuoteReader } from './application/QuoteReader';
import { CreateQuote } from './application/command/CreateQuote';
import { ConfirmQuoteUsecase } from './application/handler/ConfirmQuoteHandler';
import { ReadCurrentQuote } from './application/query/ReadCurrentQuote';
import { PgCheckoutRepository } from './infrastructure/persistence/PgCheckoutRepository';

export function checkoutOperations(context: ModuleContext): ModuleOperations {
  const pool = context.service(DATABASE_POOL);
  const members = context.ports.get(MEMBER_ACCESS_PORT);
  const pricing = context.ports.get(CHECKOUT_PRICING_PORT);
  const benefit = context.ports.get(CHECKOUT_BENEFIT_PORT);
  const voucher = context.ports.get(CHECKOUT_VOUCHER_PORT);
  const address = new AddressPort();
  const checkout = new CheckoutPort(
    context.service(SECURITY_KEYS).quote,
    new QuoteReader({
      access: members,
      address,
      benefit,
      cart: context.ports.get(CART_READ_PORT),
      catalog: context.ports.get(CHECKOUT_CATALOG_PORT),
      experience: context.ports.get(CHECKOUT_EXPERIENCE_PORT),
      invoice: context.ports.get(CHECKOUT_INVOICE_PORT),
      inventory: context.ports.get(CHECKOUT_INVENTORY_PORT),
      marketing: context.ports.get(CHECKOUT_MARKETING_PORT),
      orders: context.ports.get(CHECKOUT_ORDER_PORT),
      pricing,
      qualification: context.ports.get(CHECKOUT_QUALIFICATION_PORT),
      voucher,
    })
  );
  const repository = new PgCheckoutRepository();
  const outbox = new PgOutbox(pool);
  const create = new CreateQuote(checkout, pricing, repository, outbox, SystemClock);
  const current = new ReadCurrentQuote(members, checkout, repository, pricing);
  const confirm = new ConfirmQuoteUsecase(
    checkout,
    members,
    repository,
    pricing,
    address,
    context.ports.get(CHECKOUT_CART_PORT),
    context.ports.get(CHECKOUT_INVENTORY_PORT),
    benefit,
    voucher,
    context.ports.get(CHECKOUT_MARKETING_PORT),
    context.ports.get(CHECKOUT_ORDER_PORT),
    context.ports.get(CHECKOUT_PAYMENT_PORT),
    context.ports.get(CHECKOUT_INVOICE_PORT),
    context.ports.get(ORGANIZATION_READ_PORT),
    context.ports.get(CHECKOUT_RISK_PORT),
    outbox
  );
  return new ModuleOperations('checkout', pool, context.service(AUDIT_SINK), {
    'checkout.quote.create': (request, database) => create.execute(request, database),
    'checkout.quotes.current.read': (request, database) => current.execute(request, database),
    'order.orders.create': operationLifecycle({
      durableFinalize: true,
      execute: (request, database) => confirm.execute(request, database),
      finalize: (request, result) => confirm.finalize(request, result),
    }),
  });
}
