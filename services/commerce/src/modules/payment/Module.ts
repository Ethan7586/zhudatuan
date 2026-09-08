import { PgTransactionAccess } from '../../platform/database/PgTransactionAccess';
import { PgTransactionManager } from '../../platform/database/PgTransactionManager';
import { defineModule } from '../../composition/DefinedModule';
import { KMS_CLIENT } from '../../pipeline/KmsPort';
import { DATABASE_POOL } from '../../platform/database/Pool';
import { writeDatabaseWorkload } from '../../platform/database/Workload';
import { MEMBER_ACCESS_PORT } from '../access/public';
import { PAYMENT_BENEFIT_PORT } from '../benefit/public';
import { PAYMENT_IDENTITY_PORT } from '../identity/public';
import { PAYMENT_INVENTORY_PORT } from '../inventory/public';
import { MARKETING_RESERVE_PORT } from '../marketing/public';
import { ORDER_PAYMENT_PORT, ORDER_READ_PORT } from '../order/public';
import { ORGANIZATION_READ_PORT } from '../organization/public';
import { PAYMENT_VOUCHER_PORT } from '../voucher/public';
import { PaymentHoldReleaser, PaymentSettlement } from './infrastructure/persistence/PaymentSettlement';
import { IntentsReadHandler } from './application/handler/IntentsReadHandler';
import { IntentsCreateHandler } from './application/handler/IntentsCreateHandler';
import { RecoveriesReadHandler } from './application/handler/RecoveriesReadHandler';
import { RecoveriesResolveHandler } from './application/handler/RecoveriesResolveHandler';
import { RefundsRequestHandler } from './application/handler/RefundsRequestHandler';
import { WebhooksWechatHandler } from './application/handler/WebhooksWechatHandler';
import { PAYMENT_GATEWAY } from './application/port/PaymentGateway';
import { CheckoutPayment } from './infrastructure/persistence/CheckoutPayment';
import { PaymentPort } from './infrastructure/persistence/PaymentPort';
import { PgPaymentRepository } from './infrastructure/persistence/PgPaymentRepository';
import { PgRecoveryRepository } from './infrastructure/persistence/PgRecoveryRepository';
import { PgRefundRepository } from './infrastructure/persistence/PgRefundRepository';
import { PgWebhookInboxRepository } from './infrastructure/persistence/PgWebhookInboxRepository';
import { PgWebhookScopeReader } from './infrastructure/persistence/PgWebhookScopeReader';
import { PgPaymentContinuation } from './infrastructure/persistence/PgPaymentContinuation';
import { Manifest } from './Manifest';
import { CHECKOUT_HOLD_PORT, CHECKOUT_PAYMENT_PORT, FINANCE_PAYMENT_PORT, ORDER_EXPIRY_HOLD_PORT, ORDER_EXPIRY_PAYMENT_PORT, ORDER_IMPORT_PAYMENT_PORT } from './public/index';
import { createJobs } from './interface/job/JobFactory';
import { EVENT_SUBSCRIPTIONS } from '../../generated/EventSubscriptions';
import { PaymentGatewayRegistry } from './application/service/PaymentGatewayRegistry';

export const PaymentModule = defineModule(Manifest, {
  events: [{ handler: 'paymentcancel', events: EVENT_SUBSCRIPTIONS.paymentcancel }],
  jobs: createJobs,
  handlers: (context) => {
    const transactions = new PgTransactionAccess();
    const orders = context.ports.get(ORDER_PAYMENT_PORT);
    const organizations = context.ports.get(ORGANIZATION_READ_PORT);
    const recoveries = new PgRecoveryRepository(transactions, organizations, orders);
    const gateways = new PaymentGatewayRegistry([context.service(PAYMENT_GATEWAY)]);
    const paymentPort = new PaymentPort();
    const continuation = new PgPaymentContinuation(
      context.service(DATABASE_POOL).workload(writeDatabaseWorkload(context.workload)),
      context.service(PAYMENT_GATEWAY),
      context.service(KMS_CLIENT),
      new PaymentSettlement(context.ports.get(PAYMENT_BENEFIT_PORT), context.ports.get(PAYMENT_VOUCHER_PORT), context.ports.get(PAYMENT_INVENTORY_PORT), context.ports.get(MARKETING_RESERVE_PORT), orders),
      orders,
      context.ports.get(MEMBER_ACCESS_PORT),
      context.ports.get(PAYMENT_IDENTITY_PORT),
      new PaymentHoldReleaser(context.ports.get(PAYMENT_BENEFIT_PORT), context.ports.get(PAYMENT_VOUCHER_PORT), context.ports.get(PAYMENT_INVENTORY_PORT), context.ports.get(MARKETING_RESERVE_PORT))
    );
    return [
      new IntentsCreateHandler(context.ports.get(MEMBER_ACCESS_PORT), orders, paymentPort, gateways, continuation),
      new IntentsReadHandler(new PgPaymentRepository(transactions, context.ports.get(MEMBER_ACCESS_PORT), orders)),
      new RefundsRequestHandler(new PgRefundRepository(transactions, organizations, orders)),
      new RecoveriesReadHandler(recoveries),
      new RecoveriesResolveHandler(recoveries),
      new WebhooksWechatHandler(context.service(PAYMENT_GATEWAY), new PgWebhookScopeReader(new PgTransactionManager(context.service(DATABASE_POOL)), context.ports.get(ORDER_READ_PORT)), new PgWebhookInboxRepository(transactions, orders)),
    ];
  },
  ports: (context) => {
    const benefit = context.ports.get(PAYMENT_BENEFIT_PORT);
    const voucher = context.ports.get(PAYMENT_VOUCHER_PORT);
    const inventory = context.ports.get(PAYMENT_INVENTORY_PORT);
    const marketing = context.ports.get(MARKETING_RESERVE_PORT);
    const orders = context.ports.get(ORDER_PAYMENT_PORT);
    const settlement = new PaymentSettlement(benefit, voucher, inventory, marketing, orders);
    const holds = new PaymentHoldReleaser(benefit, voucher, inventory, marketing);
    const intents = new PgPaymentContinuation(
      context.service(DATABASE_POOL).workload(writeDatabaseWorkload(context.workload)),
      context.service(PAYMENT_GATEWAY),
      context.service(KMS_CLIENT),
      settlement,
      orders,
      context.ports.get(MEMBER_ACCESS_PORT),
      context.ports.get(PAYMENT_IDENTITY_PORT),
      holds
    );
    const payments = new PaymentPort();
    return [
      { token: CHECKOUT_PAYMENT_PORT, value: new CheckoutPayment(payments, settlement, intents) },
      { token: CHECKOUT_HOLD_PORT, value: holds },
      { token: FINANCE_PAYMENT_PORT, value: payments },
    ];
  },
  jobPorts: (context) => {
    const benefit = context.ports.get(PAYMENT_BENEFIT_PORT);
    const voucher = context.ports.get(PAYMENT_VOUCHER_PORT);
    const inventory = context.ports.get(PAYMENT_INVENTORY_PORT);
    const marketing = context.ports.get(MARKETING_RESERVE_PORT);
    const holds = new PaymentHoldReleaser(benefit, voucher, inventory, marketing);
    return [
      { token: FINANCE_PAYMENT_PORT, value: new PaymentPort() },
      { token: ORDER_IMPORT_PAYMENT_PORT, value: new PaymentPort() },
      { token: ORDER_EXPIRY_PAYMENT_PORT, value: new PaymentPort() },
      { token: ORDER_EXPIRY_HOLD_PORT, value: holds },
    ];
  },
});
