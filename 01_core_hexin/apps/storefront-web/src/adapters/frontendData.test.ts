import { describe, expect, it } from 'vitest';
import { MOCK_PRODUCTS } from '../mock/data';
import { toFrontendCategories, toFrontendOrders, toFrontendProducts } from './frontendData';

describe('multi-device frontend data adapter', () => {
  it('preserves production identifiers and SKU references', () => {
    const source = {
      ...MOCK_PRODUCTS[0],
      id: 'product-live',
      skuId: 'sku-live',
      priceMarket: 120,
      priceWelfare: 90,
      images: ['https://example.com/live.jpg'],
    };

    const [adapted] = toFrontendProducts([source]);

    expect(adapted.id).toBe('product-live');
    expect(adapted.skuId).toBe('sku-live');
    expect(adapted.imageUrl).toBe('https://example.com/live.jpg');
    expect(adapted.enterpriseSubsidyAmount).toBe(30);
  });

  it('maps real order rows without replacing order identity', () => {
    const products = toFrontendProducts(MOCK_PRODUCTS);
    const order = {
      id: 'order-live',
      orderNo: 'SW-LIVE-001',
      enterpriseId: 'enterprise-live',
      enterpriseName: '测试集团',
      mallId: 'mall-live',
      mallName: '测试商城',
      supplierId: 'supplier-live',
      supplierName: '测试供应商',
      supplierType: 'third_party' as const,
      status: 'pending_receipt' as const,
      createTime: '2026-07-24T10:00:00.000Z',
      items: [
        {
          productId: products[0].id,
          productTitle: products[0].title,
          productImage: products[0].imageUrl,
          price: products[0].price,
          quantity: 1,
          specText: '标准规格',
          itemType: products[0].itemType,
        },
      ],
      payment: {
        totalGoodsAmount: products[0].price,
        shippingFee: 0,
        welfareDeducted: products[0].price,
        mealDeducted: 0,
        wechatPaid: 0,
        finalPaidAmount: products[0].price,
        payMethodText: '福利账户支付',
      },
    };

    const [adapted] = toFrontendOrders([order], products);

    expect(adapted.id).toBe('order-live');
    expect(adapted.orderNo).toBe('SW-LIVE-001');
    expect(adapted.statusText).toBe('待收货');
    expect(adapted.items[0].product.id).toBe(products[0].id);
  });

  it('derives visible categories only from API-backed products', () => {
    const source = [
      { ...MOCK_PRODUCTS[0], categoryId: 'cat_food', categoryName: '食品饮料', title: '数据库商品甲' },
      { ...MOCK_PRODUCTS[1], categoryId: 'cat_food', categoryName: '食品饮料', title: '数据库商品乙' },
    ];

    expect(toFrontendCategories(source)).toMatchObject([
      {
        id: 'cat_food',
        name: '食品饮料',
        hotKeywords: expect.arrayContaining(['数据库商品甲', '数据库商品乙']),
      },
    ]);
    expect(toFrontendCategories([])).toEqual([]);
  });

  it('uses the immutable order item snapshot when the current catalogue no longer contains the product', () => {
    const product = MOCK_PRODUCTS[0];
    const order = {
      id: 'order-history',
      orderNo: 'SW-HISTORY-001',
      enterpriseId: 'enterprise-live',
      enterpriseName: '测试集团',
      mallId: 'mall-live',
      mallName: '测试商城',
      supplierId: 'supplier-live',
      supplierName: '历史供应商',
      supplierType: 'third_party' as const,
      status: 'completed' as const,
      createTime: '2026-07-24T10:00:00.000Z',
      items: [
        {
          productId: 'retired-product',
          productTitle: '订单中的真实历史名称',
          productImage: 'https://example.com/order-snapshot.jpg',
          price: 88,
          quantity: 1,
          specText: '历史规格',
          itemType: product.itemType,
        },
      ],
      payment: {
        totalGoodsAmount: 88,
        shippingFee: 0,
        welfareDeducted: 88,
        mealDeducted: 0,
        wechatPaid: 0,
        finalPaidAmount: 88,
        payMethodText: '福利账户支付',
      },
    };

    const [adapted] = toFrontendOrders([order], []);

    expect(adapted.items[0].product).toMatchObject({
      id: 'retired-product',
      title: '订单中的真实历史名称',
      supplierName: '历史供应商',
      purchasable: false,
    });
  });
});
