import type { ModuleContext } from '../../../../composition/ModuleRegistry';
import { PgTransactionManager } from '../../../../platform/database/PgTransactionManager';
import type { ModuleJob } from '../../../../pipeline/ModuleJob';
import { DATABASE_POOL } from '../../../../platform/database/Pool';
import { PAYMENT_BENEFIT_PORT } from '../../../benefit/public';
import { PAYMENT_CHANNEL_PORT } from '../../../channel/public';
import { PAYMENT_INVENTORY_PORT } from '../../../inventory/public';
import { MARKETING_RESERVE_PORT } from '../../../marketing/public';
import { ORDER_PAYMENT_JOB_PORT } from '../../../order/public';
import { ORGANIZATION_READ_PORT } from '../../../organization/public';
import { PAYMENT_VOUCHER_PORT } from '../../../voucher/public';
import { PAYMENT_GATEWAY } from '../../application/port/PaymentGateway';
import { RecoverPayment } from '../../application/process/RecoverPayment';
import { CancelPayment } from '../../application/process/CancelPayment';
import { PaymentDeadletter } from '../../infrastructure/persistence/PaymentDeadletter';
import { PgPaymentCancellationProcess } from '../../infrastructure/persistence/PgPaymentCancellationProcess';
import { PgPaymentRecoveryProcess } from '../../infrastructure/persistence/PgPaymentRecoveryProcess';
import { PaymentHoldReleaser, PaymentSettlement } from '../../infrastructure/persistence/PaymentSettlement';
import { RefundSettlement } from '../../infrastructure/persistence/RefundSettlement';
import { PaymentRecoveryJob } from './PaymentRecoveryJob';
import { PaymentCancellationJob } from './PaymentCancellationJob';

export function createJobs(context: ModuleContext): readonly ModuleJob[] {
  const pool = context.service(DATABASE_POOL);
  const benefit = context.ports.get(PAYMENT_BENEFIT_PORT);
  const voucher = context.ports.get(PAYMENT_VOUCHER_PORT);
  const inventory = context.ports.get(PAYMENT_INVENTORY_PORT);
  const marketing = context.ports.get(MARKETING_RESERVE_PORT);
  const orders = context.ports.get(ORDER_PAYMENT_JOB_PORT);
  const holds = new PaymentHoldReleaser(benefit, voucher, inventory, marketing);
  const dependencies = Object.freeze({
    settlement: new PaymentSettlement(benefit, voucher, inventory, marketing, orders),
    refundSettlement: new RefundSettlement(benefit, voucher, marketing, orders, context.ports.get(ORGANIZATION_READ_PORT)),
    orders,
    operations: context.ports.get(PAYMENT_CHANNEL_PORT),
    holds,
  });
  const deadletter = new PaymentDeadletter(orders);
  const gateway = context.service(PAYMENT_GATEWAY);
  const recovery = new RecoverPayment(new PgPaymentRecoveryProcess(new PgTransactionManager(pool), gateway, dependencies));
  const cancellation = new CancelPayment(new PgPaymentCancellationProcess(new PgTransactionManager(pool), gateway, holds));
  return Object.freeze([
    { id: 'paymentquery', processor: new PaymentRecoveryJob('paymentquery', recovery), deadletter },
    { id: 'paymentrefund', processor: new PaymentRecoveryJob('paymentrefund', recovery), deadletter },
    { id: 'paymentcancel', processor: new PaymentCancellationJob(cancellation) },
  ]);
}
