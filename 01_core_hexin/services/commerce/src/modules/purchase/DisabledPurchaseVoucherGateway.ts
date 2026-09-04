import type { OperationDatabase } from '../../foundation/application/ModuleOperations';
import type { QuoteVoucherGateway } from '../checkout_jiesuan';
import type { OrderVoucherGateway } from '../order_dingdan';
import type { SettlementVoucher } from '../payment/application/PaymentSettlementCore';

/** Purchase-only runtime never permits vouchers or loads the full voucher implementation. */
export class DisabledPurchaseVoucherGateway implements QuoteVoucherGateway, OrderVoucherGateway, SettlementVoucher {
  preview(_database: OperationDatabase, vouchers: readonly string[], _member: string, _scope: string): Promise<readonly never[]> {
    if (vouchers.length > 0) return Promise.reject(new Error('PURCHASE_VOUCHER_FORBIDDEN'));
    return Promise.resolve([]);
  }

  reserve(_database: OperationDatabase, _order: string, _member: string, _scope: string,
    tenders: readonly Readonly<{ reference: string; amountMinor: number }>[]): Promise<void> {
    return tenders.length > 0 ? Promise.reject(new Error('PURCHASE_VOUCHER_FORBIDDEN')) : Promise.resolve();
  }

  consume(_database: OperationDatabase, _order: string, _member: string, _voucher: string, _amountMinor: number): Promise<void> {
    return Promise.reject(new Error('PURCHASE_VOUCHER_FORBIDDEN'));
  }
}
