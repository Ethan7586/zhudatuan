import { PgOutbox } from '../../adapter/database/PgOutbox';
import { PgTransactionAccess } from '../../adapter/database/PgTransactionAccess';
import { PgTransactionManager } from '../../adapter/database/PgTransactionManager';
import { defineModule } from '../../bootstrap/DefinedModule';
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
import { MARKETING_READ_PORT, MARKETING_RESERVE_PORT } from '../marketing/public';
import { MEMBER_ADDRESS_PORT } from '../member/public';
import { ORDER_INTENT_PORT } from '../order/public';
import { ORGANIZATION_READ_PORT } from '../organization/public';
import { CHECKOUT_HOLD_PORT, CHECKOUT_PAYMENT_PORT } from '../payment/public';
import { CHECKOUT_PRICING_PORT } from '../pricing/public';
import { CHECKOUT_QUALIFICATION_PORT } from '../qualification/public';
import { RISK_DECISION_PORT } from '../risk/public';
import { CHECKOUT_VOUCHER_PORT } from '../voucher/public';
import { Manifest } from './Manifest';
import { ConfirmQuoteHandler } from './application/handler/ConfirmQuoteHandler';
import { QuoteCreateHandler } from './application/handler/QuoteCreateHandler';
import { QuotesCurrentReadHandler } from './application/handler/QuotesCurrentReadHandler';
import { RUNTIME_CHECKOUT_PORT } from './public';
import { ConfirmCheckout } from './application/service/ConfirmCheckout';
import { CheckoutReservations } from './application/service/CheckoutReservations';
import { CheckoutPort } from './application/service/CheckoutPort';
import { QuoteReader } from './application/service/QuoteReader';
import { CurrentQuoteReader } from './infrastructure/persistence/CurrentQuoteReader';
import { PgCheckoutRepository } from './infrastructure/persistence/PgCheckoutRepository';
import { PgCheckoutSessionStore } from './infrastructure/persistence/PgCheckoutSessionStore';
import { PgQuoteRepository } from './infrastructure/persistence/PgQuoteRepository';
import { QuoteCreator } from './infrastructure/persistence/QuoteCreator';
import { createJobs } from './interface/job/JobFactory';

export const CheckoutModule = defineModule(Manifest, {
  jobs: createJobs,
  handlers: (context) => {
    const pool = context.service(DATABASE_POOL);
    const members = context.ports.get(MEMBER_ACCESS_PORT);
    const pricing = context.ports.get(CHECKOUT_PRICING_PORT);
    const benefit = context.ports.get(CHECKOUT_BENEFIT_PORT);
    const voucher = context.ports.get(CHECKOUT_VOUCHER_PORT);
    const transactions = new PgTransactionAccess();
    const address = context.ports.get(MEMBER_ADDRESS_PORT);
    const inventory = context.ports.get(CHECKOUT_INVENTORY_PORT);
    const marketing = context.ports.get(MARKETING_RESERVE_PORT);
    const orders = context.ports.get(ORDER_INTENT_PORT);
    const payment = context.ports.get(CHECKOUT_PAYMENT_PORT);
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
        inventory,
        marketing: context.ports.get(MARKETING_READ_PORT),
        orders,
        pricing,
        qualification: context.ports.get(CHECKOUT_QUALIFICATION_PORT),
        risk: context.ports.get(RISK_DECISION_PORT),
        voucher,
      })
    );
    const sessions = new PgCheckoutSessionStore();
    const outbox = new PgOutbox(new PgTransactionManager(pool));
    const creator = new QuoteCreator(checkout, pricing, sessions, outbox, SystemClock);
    const current = new CurrentQuoteReader(members, checkout, sessions, pricing);
    const reservations = new CheckoutReservations(inventory, voucher, marketing, benefit, context.ports.get(CHECKOUT_HOLD_PORT));
    const confirmation = new ConfirmCheckout(
      checkout,
      members,
      sessions,
      pricing,
      context.ports.get(CHECKOUT_CART_PORT),
      reservations,
      orders,
      payment,
      context.ports.get(ORGANIZATION_READ_PORT),
      outbox
    );
    const quotes = new PgQuoteRepository(transactions, creator, current);
    const checkouts = new PgCheckoutRepository(transactions, confirmation);
    return [new QuoteCreateHandler(quotes), new QuotesCurrentReadHandler(quotes), new ConfirmQuoteHandler(checkouts, confirmation)];
  },
  jobPorts: [{ token: RUNTIME_CHECKOUT_PORT, value: new PgCheckoutSessionStore() }],
});
