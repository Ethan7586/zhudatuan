import type { AccountLog, AfterSaleRecord, CartItem, DeliveryAddress, EnterpriseMall, Order, UserCoupon, UserProfile } from '../types';
import { MOCK_ACCOUNT_LOGS, MOCK_ADDRESSES, MOCK_AFTER_SALES, MOCK_ENTERPRISE_MALLS, MOCK_ORDERS, MOCK_PRODUCTS, MOCK_USER, MOCK_USER_COUPONS } from '../mock/data';

export const STORAGE_KEYS = {
  USER: 'zhy_mall_user_profile',
  CART: 'zhy_mall_cart_items',
  ORDERS: 'zhy_mall_orders',
  LOGS: 'zhy_mall_account_logs',
  COUPONS: 'zhy_mall_user_coupons',
  AFTER_SALES: 'zhy_mall_after_sales',
  ADDRESSES: 'zhy_mall_addresses',
  FAVORITES: 'zhy_mall_favorites',
  MALL_ID: 'zhy_mall_current_id',
};

export class MallState {
  protected user: UserProfile;
  protected cart: CartItem[];
  protected orders: Order[];
  protected logs: AccountLog[];
  protected coupons: UserCoupon[];
  protected afterSales: AfterSaleRecord[];
  protected addresses: DeliveryAddress[];
  protected favorites: string[]; // Product IDs
  protected currentMallId: string;

  constructor() {
    // 当前商城 ID 是全局选择；其余业务数据按商城命名空间隔离。
    this.currentMallId = this.loadFromStorage(STORAGE_KEYS.MALL_ID, MOCK_USER.currentMallId);
    this.user = this.createDefaultUser();
    this.cart = [];
    this.orders = [];
    this.logs = [];
    this.coupons = [];
    this.afterSales = [];
    this.addresses = [];
    this.favorites = [];
    this.loadMallState();
  }

  protected getScopedKey(key: string, mallId = this.currentMallId): string {
    return `${key}:${mallId}`;
  }

  protected createDefaultUser(): UserProfile {
    const mall = MOCK_ENTERPRISE_MALLS.find((item) => item.id === this.currentMallId) || MOCK_ENTERPRISE_MALLS[0];
    return {
      ...MOCK_USER,
      currentMallId: mall.id,
      enterpriseId: mall.enterpriseId,
      enterpriseName: mall.enterpriseName,
      distributorId: mall.distributorId || MOCK_USER.distributorId,
    };
  }

  protected createDefaultCart(): CartItem[] {
    if (this.currentMallId !== MOCK_USER.currentMallId) return [];
    const defaultCart: CartItem[] = [
      {
        id: 'cart_01',
        productId: 'p_101',
        product: MOCK_PRODUCTS[0],
        quantity: 1,
        selectedSpec: { 规格重量: '10kg/袋' },
        selected: true,
        distributorId: MOCK_USER.distributorId,
      },
      {
        id: 'cart_02',
        productId: 'p_701',
        product: MOCK_PRODUCTS[14], // 星巴克100元电子卡
        quantity: 2,
        selectedSpec: { 卡面金额: '100元电子卡' },
        selected: true,
        distributorId: MOCK_USER.distributorId,
      },
    ];
    return defaultCart;
  }

  protected loadMallState(): void {
    const defaultUser = this.createDefaultUser();
    this.user = this.loadFromStorage(this.getScopedKey(STORAGE_KEYS.USER), defaultUser);
    this.user = {
      ...this.user,
      currentMallId: defaultUser.currentMallId,
      enterpriseId: defaultUser.enterpriseId,
      enterpriseName: defaultUser.enterpriseName,
      distributorId: defaultUser.distributorId,
    };
    this.cart = this.loadFromStorage(this.getScopedKey(STORAGE_KEYS.CART), this.createDefaultCart());
    this.orders = this.loadFromStorage(
      this.getScopedKey(STORAGE_KEYS.ORDERS),
      MOCK_ORDERS.filter((order) => order.mallId === this.currentMallId)
    );
    this.logs = this.loadFromStorage(this.getScopedKey(STORAGE_KEYS.LOGS), this.currentMallId === MOCK_USER.currentMallId ? MOCK_ACCOUNT_LOGS : []);
    this.coupons = this.loadFromStorage(this.getScopedKey(STORAGE_KEYS.COUPONS), this.currentMallId === MOCK_USER.currentMallId ? MOCK_USER_COUPONS : []);
    this.afterSales = this.loadFromStorage(this.getScopedKey(STORAGE_KEYS.AFTER_SALES), this.currentMallId === MOCK_USER.currentMallId ? MOCK_AFTER_SALES : []);
    this.addresses = this.loadFromStorage(this.getScopedKey(STORAGE_KEYS.ADDRESSES), MOCK_ADDRESSES);
    this.favorites = this.loadFromStorage(this.getScopedKey(STORAGE_KEYS.FAVORITES), this.currentMallId === MOCK_USER.currentMallId ? ['p_101', 'p_201', 'p_701'] : []);
    this.user.couponCount = this.coupons.filter((coupon) => coupon.status === 'unused').length;
  }

  protected loadFromStorage<T>(key: string, defaultValue: T): T {
    try {
      const saved = localStorage.getItem(key);
      return saved ? JSON.parse(saved) : defaultValue;
    } catch {
      return defaultValue;
    }
  }

  protected saveToStorage(key: string, data: any): void {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
      console.warn('Storage saving error:', e);
    }
  }

  // --- Enterprise & Mall Operations ---
  public getMalls(): EnterpriseMall[] {
    return MOCK_ENTERPRISE_MALLS;
  }

  public getCurrentMall(): EnterpriseMall {
    const mall = MOCK_ENTERPRISE_MALLS.find((m) => m.id === this.currentMallId);
    return mall || MOCK_ENTERPRISE_MALLS[0];
  }

  public switchMall(mallId: string): EnterpriseMall {
    const exists = MOCK_ENTERPRISE_MALLS.some((mall) => mall.id === mallId);
    if (!exists) throw new Error('商城不存在或无访问权限');
    this.currentMallId = mallId;
    this.saveToStorage(STORAGE_KEYS.MALL_ID, mallId);
    this.loadMallState();
    const mall = this.getCurrentMall();
    this.saveUser();
    return mall;
  }

  // --- User Profile & Welfare Balances ---
  public getUserProfile(): UserProfile {
    return { ...this.user };
  }

  protected saveUser(): void {
    this.saveToStorage(this.getScopedKey(STORAGE_KEYS.USER), this.user);
  }
}
