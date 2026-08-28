import type { OperationDatabase } from '../../../foundation/application/ModuleOperations';
import { BenefitPort } from '../../benefit/BenefitPort';
import { FinancePort } from '../../finance/application/port/FinancePort';
import { FulfillmentPort } from '../../fulfillment/FulfillmentPort';
import { InventoryPort } from '../../inventory/InventoryPort';
import { MarketingPort } from '../../marketing/MarketingPort';
import { OrderPort } from '../../order/OrderPort';
import { VoucherPort } from '../../voucher/application/port/VoucherPort';
import {
  PaymentSettlementCore,
  type SettlementBenefit,
  type SettlementFulfillment,
  type SettlementInventory,
  type SettlementMarketing,
  type SettlementOrders,
  type SettlementVoucher,
} from './PaymentSettlementCore';

export type { SettlementTarget } from './PaymentSettlementCore';

const defaultBenefit = new BenefitPort(new FinancePort());
const defaultVoucher = new VoucherPort(new FinancePort());

/** Full-runtime defaults around the dependency-explicit canonical settlement. */
export class PaymentSettlement extends PaymentSettlementCore {
  constructor(
    benefit: SettlementBenefit = defaultBenefit,
    voucher: SettlementVoucher = defaultVoucher,
    inventory: SettlementInventory = new InventoryPort(),
    marketing: SettlementMarketing = new MarketingPort(),
    fulfillment: SettlementFulfillment = new FulfillmentPort(),
    orders: SettlementOrders = new OrderPort(),
  ) {
    super(benefit, voucher, inventory, marketing, fulfillment, orders);
  }
}

export async function releaseOrderHolds(database: OperationDatabase, order: string): Promise<void> {
  await new InventoryPort().release(database, order);
  await defaultBenefit.release(database, order);
  await defaultVoucher.release(database, order);
  await new MarketingPort().release(database, order);
  await database.query(`update payment.intenttender set state='released' where intent_id in(select id from payment.intent where order_id=$1)
    and state in('planned','held')`, [order]);
}
