import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import { PaymentSettlementCore, type SettlementBenefit, type SettlementFulfillment, type SettlementInventory, type SettlementMarketing, type SettlementOrders, type SettlementVoucher } from './PaymentSettlementCore';

export type { SettlementTarget } from './PaymentSettlementCore';

export class PaymentSettlement extends PaymentSettlementCore {
  constructor(benefit: SettlementBenefit, voucher: SettlementVoucher, inventory: SettlementInventory, marketing: SettlementMarketing, fulfillment: SettlementFulfillment, orders: SettlementOrders) {
    super(benefit, voucher, inventory, marketing, fulfillment, orders);
  }
}

interface HoldReleasePort {
  release(context: WriteTransactionContext, order: string): Promise<void>;
}

export class PaymentHoldReleaser {
  private readonly transactions = new PgTransactionAccess();
  constructor(
    private readonly benefit: HoldReleasePort,
    private readonly voucher: HoldReleasePort,
    private readonly inventory: HoldReleasePort,
    private readonly marketing: HoldReleasePort
  ) {}

  async release(context: WriteTransactionContext, order: string): Promise<void> {
    const database = this.transactions.database(context);
    await this.inventory.release(context, order);
    await this.voucher.release(context, order);
    await this.benefit.release(context, order);
    await this.marketing.release(context, order);
    await database.query(
      `update payment.intenttender set state='released' where intent_id in(select id from payment.intent where order_id=$1)
      and state in('planned','held')`,
      [order]
    );
  }
}
