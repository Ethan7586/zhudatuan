import type { LaptopPage } from '../manifest/StorefrontRoute';

export const STOREFRONT_WEB_STANDARD_ID = 'shop-storefront-standard-v2' as const;

export const STOREFRONT_WEB_PAGES = ['home-1366', 'home-1440', 'category', 'detail', 'cart', 'orders'] as const satisfies readonly LaptopPage[];

export type StorefrontWebSurface = 'standard' | 'wide';
export type StorefrontWebPresetId = 'standard-1366' | 'wide-1440';

export type StorefrontWebPreset = {
  readonly id: StorefrontWebPresetId;
  readonly surface: StorefrontWebSurface;
  readonly label: string;
  readonly width: number;
  readonly height: number;
  readonly defaultPage: LaptopPage;
};

export const STOREFRONT_WEB_PRESETS = Object.freeze({
  'standard-1366': {
    id: 'standard-1366',
    surface: 'standard',
    label: '标准电脑页面',
    width: 1366,
    height: 768,
    defaultPage: 'home-1366',
  },
  'wide-1440': {
    id: 'wide-1440',
    surface: 'wide',
    label: '宽屏电脑页面',
    width: 1440,
    height: 900,
    defaultPage: 'home-1440',
  },
} satisfies Record<StorefrontWebPresetId, StorefrontWebPreset>);

export const STOREFRONT_WEB_SURFACE_COPY = Object.freeze({
  standard: {
    frameBadge: '电脑标准版',
    headerBadge: '企业福利商城',
    pageSwitcherLabel: '商城页面：',
    wideHomeBadge: '标准商品首页',
    wideHomeNotice: '企业专属商品、权益余额和订单状态均来自平台权威数据。',
    wideHomeGridBadge: '标准商品列表',
    wideHomeContainer: '自适应内容区域',
    wideHomeProductCount: 8,
    cartLayoutLabel: '安全结算',
    ordersLayoutLabel: '订单中心',
  },
  wide: {
    frameBadge: '电脑宽屏版',
    headerBadge: '企业福利商城',
    pageSwitcherLabel: '商城页面：',
    wideHomeBadge: '宽屏商品首页',
    wideHomeNotice: '宽屏布局提升商品浏览密度，不改变业务规则与权威数据源。',
    wideHomeGridBadge: '宽屏商品列表',
    wideHomeContainer: '最大内容宽度 1440px',
    wideHomeProductCount: 10,
    cartLayoutLabel: '宽屏安全结算',
    ordersLayoutLabel: '宽屏订单中心',
  },
} satisfies Record<
  StorefrontWebSurface,
  {
    readonly frameBadge: string;
    readonly headerBadge: string;
    readonly pageSwitcherLabel: string;
    readonly wideHomeBadge: string;
    readonly wideHomeNotice: string;
    readonly wideHomeGridBadge: string;
    readonly wideHomeContainer: string;
    readonly wideHomeProductCount: number;
    readonly cartLayoutLabel: string;
    readonly ordersLayoutLabel: string;
  }
>);

export function defaultStorefrontWebPage(surface: StorefrontWebSurface): LaptopPage {
  return surface === 'wide' ? STOREFRONT_WEB_PRESETS['wide-1440'].defaultPage : STOREFRONT_WEB_PRESETS['standard-1366'].defaultPage;
}
