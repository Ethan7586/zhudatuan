import type { Product } from '../src/entity/product';
import type { Address } from '../src/feature/account/model/Address';
import type { Profile } from '../src/feature/account/model/Profile';

export function productFixture(overrides: Partial<Product> = {}): Product {
  return {
    listingId: 'listing-one',
    productId: 'product-one',
    skuId: 'sku-one',
    title: '测试商品',
    subtitle: '生产数据映射测试',
    images: ['https://example.com/product.jpg'],
    priceMarketMinor: 12000,
    priceMallMinor: 10000,
    priceWelfareMinor: 9000,
    currency: 'CNY',
    categoryId: 'category-one',
    categoryName: '食品饮料',
    brand: '测试品牌',
    tags: [],
    supplierId: 'supplier-one',
    supplierName: '测试供应商',
    itemType: 'physical',
    allowedAccounts: ['welfare'],
    stock: 10,
    salesCount: 0,
    rating: 5,
    reviewCount: 0,
    deliverySla: '次日达',
    qualification: { eligible: true, policyVersion: 1 },
    saleability: { state: 'saleable', reasons: [] },
    version: '1',
    updatedAt: '2026-08-31T00:00:00.000Z',
    skus: [],
    ...overrides,
  };
}

export function profileFixture(overrides: Partial<Profile> = {}): Profile {
  return {
    id: 'member-one',
    employeeId: 'EMP-ONE',
    name: '测试会员',
    avatar: '',
    phone: '138****0000',
    jobTitle: '员工会员',
    department: '测试部门',
    enterpriseId: 'enterprise-one',
    enterpriseName: '测试企业',
    currentMallId: 'mall-one',
    welfareBalanceMinor: 20000,
    mealBalanceMinor: 10000,
    couponCount: 0,
    assuranceLevel: 'phone',
    phoneVerified: true,
    paymentEligible: true,
    accessVersion: 1,
    locale: 'zh-CN',
    timezone: 'Asia/Shanghai',
    marketingAllowed: false,
    preferenceVersion: 1,
    ...overrides,
  };
}

export function addressFixture(overrides: Partial<Address> = {}): Address {
  return {
    id: 'address-one',
    recipient: '测试会员',
    mobile: '13800000000',
    province: '上海市',
    city: '上海市',
    district: '浦东新区',
    detail: '测试路一号',
    isDefault: true,
    version: 1,
    status: 'active',
    ...overrides,
  };
}
