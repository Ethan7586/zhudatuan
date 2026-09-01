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
import { CHECKOUT_MARKETING_PORT } from '../marketing/public';
import { MEMBER_ADDRESS_PORT } from '../member/public';
import { CHECKOUT_ORDER_PORT } from '../order/public';
import { ORGANIZATION_READ_PORT } from '../organization/public';
import { CHECKOUT_PAYMENT_PORT } from '../payment/public';
import { CHECKOUT_PRICING_PORT } from '../pricing/public';
import { CHECKOUT_QUALIFICATION_PORT } from '../qualification/public';
import { CHECKOUT_RISK_PORT } from '../risk/public';
import { CHECKOUT_VOUCHER_PORT } from '../voucher/public';
import { Manifest } from './Manifest';
import { ConfirmQuoteHandler } from './application/handler/ConfirmQuoteHandler';
import { QuoteCreateHandler } from './application/handler/QuoteCreateHandler';
import { QuotesCurrentReadHandler } from './application/handler/QuotesCurrentReadHandler';
import { RUNTIME_CHECKOUT_PORT } from './public';
import { CheckoutConfirmationService } from './infrastructure/persistence/CheckoutConfirmationService';
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
    const sessions = new PgCheckoutSessionStore();
    const outbox = new PgOutbox(new PgTransactionManager(pool));
    const creator = new QuoteCreator(checkout, pricing, sessions, outbox, SystemClock);
    const current = new CurrentQuoteReader(members, checkout, sessions, pricing);
    const confirmation = new CheckoutConfirmationService(
      checkout,
      members,
      sessions,
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
    const quotes = new PgQuoteRepository(transactions, creator, current);
    const checkouts = new PgCheckoutRepository(transactions, confirmation);
    return [new QuoteCreateHandler(quotes), new QuotesCurrentReadHandler(quotes), new ConfirmQuoteHandler(checkouts, confirmation)];
  },
  jobPorts: [{ token: RUNTIME_CHECKOUT_PORT, value: new PgCheckoutSessionStore() }],
});
