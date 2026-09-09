import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Listing, ProductDetail, ProductDetailSection } from '../model/Product';
import type { ProductDetailSectionViewModel, ProductDetailViewModel } from '../viewmodel/ProductDetailViewModel';
import { ProductDrawer } from './ProductDrawer';
import { listingFixture } from '../test/ProductFixture';

afterEach(() => cleanup());

describe('ProductDrawer', () => {
  it('keeps quick inspection in the drawer and offers a direct full-detail action', async () => {
    const openDetail = vi.fn();
    render(
      <ProductDrawer listing={listing} tab="overview" detail={detail} sections={readySections()} onTab={() => undefined} onClose={() => undefined} onDetail={openDetail} onAction={() => undefined} onPool={() => undefined} canUse={allow} />
    );

    expect(screen.getByRole('heading', { name: '商品概览' })).toBeTruthy();
    await userEvent.setup().click(screen.getByRole('button', { name: '打开完整商品详情' }));
    expect(openDetail).toHaveBeenCalledWith(listing);
  });

  it('isolates a pricing failure to its panel and retries only the failed section', async () => {
    const core = section('core', detail);
    const pricing = section('pricing', undefined, 'unavailable', '报价服务暂时不可用；其他商品信息仍可查看。');
    const sections = readySections({ core, pricing });
    const view = render(
      <ProductDrawer listing={listing} tab="overview" detail={detail} sections={sections} onTab={() => undefined} onClose={() => undefined} onDetail={() => undefined} onAction={() => undefined} onPool={() => undefined} canUse={allow} />
    );

    expect(screen.getByRole('heading', { name: '商品概览' })).toBeTruthy();
    expect(screen.queryByText('报价服务暂时不可用；其他商品信息仍可查看。')).toBeNull();
    view.rerender(
      <ProductDrawer listing={listing} tab="malls" detail={detail} sections={sections} onTab={() => undefined} onClose={() => undefined} onDetail={() => undefined} onAction={() => undefined} onPool={() => undefined} canUse={allow} />
    );
    expect(screen.getByText('报价服务暂时不可用；其他商品信息仍可查看。')).toBeTruthy();
    await userEvent.setup().click(screen.getByRole('button', { name: '重试' }));
    expect(pricing.refresh).toHaveBeenCalledTimes(1);
    expect(core.refresh).not.toHaveBeenCalled();
  });

  it('offers contextual pool management only after a published listing is taken down', async () => {
    const openPool = vi.fn();
    const unpublished = { ...listing, status: 'unpublished' };
    const view = render(
      <ProductDrawer listing={listing} tab="source" detail={detail} sections={readySections()} onTab={() => undefined} onClose={() => undefined} onDetail={() => undefined} onAction={() => undefined} onPool={openPool} canUse={allow} />
    );
    expect(screen.getByRole('button', { name: '管理商品投池' }).hasAttribute('disabled')).toBe(true);
    view.rerender(
      <ProductDrawer listing={unpublished} tab="source" detail={detail} sections={readySections()} onTab={() => undefined} onClose={() => undefined} onDetail={() => undefined} onAction={() => undefined} onPool={openPool} canUse={allow} />
    );
    await userEvent.setup().click(screen.getByRole('button', { name: '管理商品投池' }));
    expect(openPool).toHaveBeenCalledWith(unpublished);
  });

  it('keeps read actions available while every denied write clearly explains why it is disabled', () => {
    render(
      <ProductDrawer
        listing={listing}
        tab="overview"
        detail={detail}
        sections={readySections()}
        onTab={() => undefined}
        onClose={() => undefined}
        onDetail={() => undefined}
        onAction={() => undefined}
        onPool={() => undefined}
        canUse={() => false}
      />
    );

    expect(screen.getByRole('button', { name: '打开完整商品详情' }).getAttribute('title')).toBe('当前账号没有查看完整商品详情的权限。');
    expect(screen.getByRole('button', { name: '下架' }).getAttribute('title')).toBe('当前账号没有上架或下架商品的权限。');
    expect(screen.getByRole('button', { name: '设置价格' }).getAttribute('title')).toBe('当前账号没有设置商品价格的权限。');
    expect(screen.getByRole('button', { name: '归档' }).getAttribute('title')).toBe('当前账号没有归档商品的权限。');
    expect(screen.getByRole('button', { name: '编辑商品' }).getAttribute('title')).toBe('当前账号没有编辑商品的权限。');
  });
});

const allow = () => true;

function readySections(overrides: Partial<ProductDetailViewModel['sections']> = {}): ProductDetailViewModel['sections'] {
  return {
    core: section('core', detail),
    pricing: section('pricing', detail),
    inventory: section('inventory', detail),
    qualification: section('qualification', detail),
    ...overrides,
  };
}

function section(sectionName: ProductDetailSection, data: ProductDetail | undefined, condition: ProductDetailSectionViewModel['condition'] = 'ready', error?: string): ProductDetailSectionViewModel {
  return { section: sectionName, data, condition, refresh: vi.fn(), ...(error === undefined ? {} : { error }) };
}

const listing: Listing = listingFixture();

const detail = {
  id: 'product:one',
  title: '办公福利礼盒',
  product_type: 'physical',
  status: 'active',
  version: 7,
  category_id: 'category:office',
  category_name: '办公用品',
  brand_id: null,
  brand_name: null,
  owner_partner_id: null,
  owner_partner_name: null,
  skus: [{ id: 'sku:one', code: 'SKU-1', status: 'active', specifications: [], version: 2 }],
  listings: [{ id: 'listing:one', scope: 'mall:one', scopeName: '员工福利商城', pool: null, poolName: null, sku: 'sku:one', skuCode: 'SKU-1', title: '办公福利礼盒', status: 'published', version: 3 }],
  prices: [{ sku: 'sku:one', skuCode: 'SKU-1', scope: 'mall:one', scopeName: '员工福利商城', currency: 'CNY', amountMinor: 9900, bookStatus: 'active', bookVersion: 'offer:four', priceVersion: 4 }],
  inventory: [{ sku: 'sku:one', skuCode: 'SKU-1', scope: 'mall:one', scopeName: '员工福利商城', location: 'warehouse:one', locationName: '主仓库', onhand: 14, safety: 2 }],
} as unknown as ProductDetail;
