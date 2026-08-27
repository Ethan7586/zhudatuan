import type { WechatPayTransaction } from './Models';

export interface VerifiedWechatPayNotification {
  notificationId: string;
  eventType: 'TRANSACTION.SUCCESS';
  createTime: string;
  resourceType: string;
  transaction: WechatPayTransaction;
  payerOpenidHash: string;
  summary: WechatPayNotificationSummary;
}

export interface WechatPayNotificationSummary {
  notificationId: string;
  eventType: 'TRANSACTION.SUCCESS';
  createTime: string;
  resourceType: string;
  transactionId: string;
  outTradeNo: string;
  tradeState: 'SUCCESS';
  successTime: string;
  totalCents: number;
  currency: 'CNY';
}

export interface ExpectedWechatPayment {
  outTradeNo: string;
  totalCents: number;
  payerOpenid: string;
}

export type WechatPayNotificationKind = 'transaction' | 'refund';

export interface VerifiedWechatRefundNotification {
  notificationId: string;
  eventType: 'REFUND.SUCCESS' | 'REFUND.ABNORMAL' | 'REFUND.CLOSED';
  createTime: string;
  resourceType: string;
  mchId: string;
  refund: WechatRefundNotificationResource;
  summary: WechatRefundNotificationSummary;
}

export interface WechatRefundNotificationResource {
  refundId: string;
  outRefundNo: string;
  transactionId: string;
  outTradeNo: string;
  status: 'SUCCESS' | 'ABNORMAL' | 'CLOSED';
  successTime: string | null;
  amount: {
    total: number;
    refund: number;
    payerTotal: number;
    payerRefund: number;
  };
}

export interface WechatRefundNotificationSummary {
  notificationId: string;
  eventType: 'REFUND.SUCCESS' | 'REFUND.ABNORMAL' | 'REFUND.CLOSED';
  createTime: string;
  resourceType: string;
  mchId: string;
  refundId: string;
  outRefundNo: string;
  transactionId: string;
  outTradeNo: string;
  refundStatus: 'SUCCESS' | 'ABNORMAL' | 'CLOSED';
  successTime: string | null;
  refundCents: number;
  totalCents: number;
  payerRefundCents: number;
  payerTotalCents: number;
}
