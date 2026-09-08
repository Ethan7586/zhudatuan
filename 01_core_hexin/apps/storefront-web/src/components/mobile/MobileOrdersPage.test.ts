import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { FrontendOrder, FrontendOrderItem, FrontendProduct } from '../../adapters/frontendData';

function orderItem(id: string, title: string, supplierName: string): FrontendOrderItem {
  return {
    productId: id,
    productTitle: title,
    productImage: `/images/${id}.png`,
    price: 100,
    quantity: 1,
    specText: '默认规格',
    itemType: 'physical',
    priceAtPurchase: 100,
    product: {
      id,
      title,
      supplierName,
      supplierType: 'third_party',
      imageUrl: `/images/${id}.png`,
    } as FrontendProduct,
  };
}

function order(id: string, items: FrontendOrderItem[], supplierName: string): FrontendOrder {
  return {
    id,
    orderId: id,
    orderNo: `ORDER-${id}`,
    enterpriseId: 'enterprise-one',
    enterpriseName: '测试企业',
    mallId: 'mall-one',
    mallName: '测试商城',
    supplierId: `supplier-${id}`,
    supplierName,
    supplierType: 'third_party',
    status: 'pending_receipt',
    statusText: '待收货',
    createTime: '2026-09-09T04:00:00.000Z',
    createdAt: '2026-09-09T04:00:00.000Z',
    totalAmount: 527,
    welfareDeduction: 0,
    items,
    payment: {
      totalGoodsAmount: 527,
      shippingFee: 0,
      welfareDeducted: 0,
      mealDeducted: 0,
      wechatPaid: 527,
      finalPaidAmount: 527,
      payMethodText: '微信支付',
    },
  };
}

const presentationOrders = [
  order('single', [orderItem('rice', '五常稻香米企业精选礼盒', '宏泰甄选自营')], '宏泰甄选自营'),
  order('split', [
    orderItem('grain', '生态杂粮组合装', '江城粮仓'),
    orderItem('kettle', '恒温电热水壶', '湖畔生活家电'),
  ], '供应商拆单汇总'),
];

const mall = vi.hoisted(() => ({
  presentationOrders: [] as FrontendOrder[],
  mobileFulfillmentSimulationStage: null,
  setMobileFulfillmentSimulationStage: vi.fn(),
  setMpPage: vi.fn(),
  setAndroidPage: vi.fn(),
  showToast: vi.fn(),
  triggerPendingFeature: vi.fn(),
}));

vi.mock('../../context/MallContext', () => ({ useMall: () => mall }));

import { MobileOrdersPage } from './MobileOrdersPage';

describe('mobile order list presentation', () => {
  it('keeps the header quiet and exposes merchant ownership for single and split orders', () => {
    mall.presentationOrders = presentationOrders;
    const html = renderToStaticMarkup(React.createElement(MobileOrdersPage, { mode: 'mini-program' }));

    expect(html).toContain('aria-label="共 2 笔订单"');
    expect(html).not.toContain('进度实时同步');
    expect(html).toContain('宏泰甄选自营');
    expect(html).toContain('合并支付订单');
    expect(html).toContain('来自 2 家商户 · 分 2 个包裹配送');
    expect(html).toContain('江城粮仓');
    expect(html).toContain('湖畔生活家电');
    expect(html).toContain('查看 2 个包裹进度');
  });
});
