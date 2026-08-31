import type { ModuleContext } from '../../bootstrap/ModuleRegistry';
import { KMS_CLIENT } from '../../foundation/infrastructure/KmsClient';
import { DATABASE_POOL } from '../../foundation/persistence/Pool';
import { MEMBER_ACCESS_PORT } from '../access/public';
import { PAYMENT_BENEFIT_PORT } from '../benefit/public';
import { PAYMENT_FULFILLMENT_PORT } from '../fulfillment/public';
import { PgPaymentIdentityPort } from '../identity/public';
import { PAYMENT_INVENTORY_PORT } from '../inventory/public';
import { PAYMENT_MARKETING_PORT } from '../marketing/public';
import { PAYMENT_ORDER_PORT } from '../order/public';
import { PAYMENT_VOUCHER_PORT } from '../voucher/public';
import { CheckoutPayment } from './CheckoutPayment';
import { PreparePayment } from './application/PreparePayment';
import { PaymentPort } from './PaymentPort';
import { PaymentHoldReleaser, PaymentSettlement } from './application/PaymentSettlement';
import { PAYMENT_GATEWAY } from './application/port/PaymentGateway';
import { writeDatabaseWorkload } from '../../foundation/persistence/Workload';

export interface PaymentComposition {
  readonly checkout: CheckoutPayment;
  readonly payments: PaymentPort;
  readonly settlement: PaymentSettlement;
}

const compositions = new WeakMap<ModuleContext, PaymentComposition>();

/** Single composition root keeps Payment API, Jobs and Public Ports aligned. */
export function paymentComposition(context: ModuleContext): PaymentComposition {
  const existing = compositions.get(context);
  if (existing) return existing;
  const benefit = context.ports.get(PAYMENT_BENEFIT_PORT);
  const voucher = context.ports.get(PAYMENT_VOUCHER_PORT);
  const inventory = context.ports.get(PAYMENT_INVENTORY_PORT);
  const marketing = context.ports.get(PAYMENT_MARKETING_PORT);
  const fulfillment = context.ports.get(PAYMENT_FULFILLMENT_PORT);
  const orders = context.ports.get(PAYMENT_ORDER_PORT);
  const settlement = new PaymentSettlement(benefit, voucher, inventory, marketing, fulfillment, orders);
  const holds = new PaymentHoldReleaser(benefit, voucher, inventory, marketing);
  const intents = new PreparePayment(
    context.service(DATABASE_POOL).workload(writeDatabaseWorkload(context.workload)),
    context.service(PAYMENT_GATEWAY),
    context.service(KMS_CLIENT),
    settlement,
    orders,
    context.ports.get(MEMBER_ACCESS_PORT),
    new PgPaymentIdentityPort(),
    holds
  );
  const payments = new PaymentPort();
  const composition = Object.freeze({ checkout: new CheckoutPayment(payments, settlement, intents), payments, settlement });
  compositions.set(context, composition);
  return composition;
}
