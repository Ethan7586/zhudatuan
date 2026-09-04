import type { AccountLog, AfterSaleRecord, OrderStatus, UserCoupon } from '../types';
import { MallOrders } from './mallOrders';
import { STORAGE_KEYS } from './mallState';

class MallService extends MallOrders {
  // --- After-Sales Management ---
  public getAfterSales(): AfterSaleRecord[] {
    return [...this.afterSales];
  }

  public applyAfterSale(params: { orderId: string; type: 'refund_only' | 'return_goods' | 'exchange'; reason: string; description: string }): AfterSaleRecord {
    const order = this.getOrderById(params.orderId);
    if (!order) throw new Error('Order not found');

    const newRecord: AfterSaleRecord = {
      id: `as_${Date.now()}`,
      afterSaleNo: `AS${Date.now()}`,
      orderId: order.id,
      orderNo: order.orderNo,
      supplierName: order.supplierName,
      applyTime: new Date().toLocaleString('zh-CN', { hour12: false }),
      reason: params.reason,
      type: params.type,
      status: 'submitted',
      refundAmount: order.payment.finalPaidAmount,
      description: params.description,
      items: order.items,
      distributorId: this.user.distributorId,
    };

    order.status = 'after_sale';
    this.afterSales.unshift(newRecord);

    this.saveToStorage(this.getScopedKey(STORAGE_KEYS.ORDERS), this.orders);
    this.saveToStorage(this.getScopedKey(STORAGE_KEYS.AFTER_SALES), this.afterSales);

    return newRecord;
  }

  // --- Accounts & Transaction Logs ---
  public getAccountLogs(type?: 'welfare' | 'meal' | 'all'): AccountLog[] {
    if (!type || type === 'all') return [...this.logs];
    return this.logs.filter((l) => l.accountType === type);
  }

  // --- Coupons ---
  public getUserCoupons(status?: 'unused' | 'used' | 'expired' | 'all'): UserCoupon[] {
    if (!status || status === 'all') return [...this.coupons];
    return this.coupons.filter((c) => c.status === status);
  }

  public simulateVerifyCoupon(couponId: string): UserCoupon | undefined {
    const cpn = this.coupons.find((c) => c.id === couponId);
    if (cpn && cpn.status === 'unused') {
      cpn.status = 'used';
      this.user.couponCount = this.coupons.filter((c) => c.status === 'unused').length;
      this.saveUser();
      this.saveToStorage(this.getScopedKey(STORAGE_KEYS.COUPONS), this.coupons);
    }
    return cpn;
  }
}

export const mallService = new MallService();
