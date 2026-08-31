import type { OperationDatabase } from '../../../foundation/application/ModuleOperations';
import { PaymentSettlementCore, type SettlementBenefit, type SettlementFulfillment, type SettlementInventory, type SettlementMarketing, type SettlementOrders, type SettlementVoucher } from './PaymentSettlementCore';

export type { SettlementTarget } from './PaymentSettlementCore';

export class PaymentSettlement extends PaymentSettlementCore {
  constructor(benefit: SettlementBenefit, voucher: SettlementVoucher, inventory: SettlementInventory, marketing: SettlementMarketing, fulfillment: SettlementFulfillment, orders: SettlementOrders) {
    super(benefit, voucher, inventory, marketing, fulfillment, orders);
  }
}

interface HoldReleasePort {
  release(database: OperationDatabase, order: string): Promise<void>;
}

export class PaymentHoldReleaser {
  constructor(
    private readonly benefit: HoldReleasePort,
    private readonly voucher: HoldReleasePort,
    private readonly inventory: HoldReleasePort,
    private readonly marketing: HoldReleasePort
  ) {}

  async release(database: OperationDatabase, order: string): Promise<void> {
    await this.inventory.release(database, order);
    await this.voucher.release(database, order);
    await this.benefit.release(database, order);
    await this.marketing.release(database, order);
    await database.query(
      `update payment.intenttender set state='released' where intent_id in(select id from payment.intent where order_id=$1)
      and state in('planned','held')`,
      [order]
    );
  }
}
