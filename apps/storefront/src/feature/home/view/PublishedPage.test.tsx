// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ExperiencePage } from '@shop/contract';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { productFixture } from '../../../../test/Fixture';
import type { useHomeViewModel } from '../viewmodel/HomeViewModel';
import { PublishedPage } from './PublishedPage';

afterEach(cleanup);

describe('PublishedPage', () => {
  it('renders every supported block and keeps all visible actions executable', () => {
    const navigateAction = vi.fn();
    const openProduct = vi.fn();
    const addToCart = vi.fn();
    const product = productFixture({ listingId: 'listing:one', productId: 'product:one', title: '中秋关怀礼盒' });
    const viewmodel = { presentationProducts: [product], navigateAction, openProduct, addToCart } as unknown as ReturnType<typeof useHomeViewModel>;
    render(<PublishedPage page={page} viewmodel={viewmodel} />);

    expect(screen.getByRole('heading', { name: '秋日员工关怀' })).toBeTruthy();
    expect(screen.getByText('本周五前完成选购')).toBeTruthy();
    expect(screen.getByText('关怀说明')).toBeTruthy();
    expect(screen.getByText('中秋关怀礼盒')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '立即查看' }));
    expect(navigateAction).toHaveBeenCalledWith({ type: 'category', target: 'category:care' });
    fireEvent.click(screen.getByRole('button', { name: '查看订单' }));
    expect(navigateAction).toHaveBeenCalledWith({ type: 'link', target: '/pages/orders' });
    fireEvent.click(screen.getByRole('button', { name: /暂无商品图片 中秋关怀礼盒/ }));
    expect(openProduct).toHaveBeenCalledWith('product:one');
    fireEvent.click(screen.getByRole('button', { name: '将中秋关怀礼盒加入购物车' }));
    expect(addToCart).toHaveBeenCalledWith(product, 1);
  });
});

const page: ExperiencePage = { id: 'page:care', path: 'pages/care', blocks: [
  { id: 'hero:care', component: 'hero', content: { eyebrow: '企业专场', title: '秋日员工关怀', subtitle: '精选福利，温暖抵达' }, action: { type: 'category', target: 'category:care' } },
  { id: 'notice:care', component: 'notice', content: { text: '本周五前完成选购' } },
  { id: 'shortcut:care', component: 'shortcut', content: { title: '快捷入口', items: [{ id: 'orders', label: '查看订单', action: { type: 'link', target: '/pages/orders' } }] } },
  { id: 'collection:care', component: 'productcollection', content: { title: '关怀好物', listingIds: ['listing:one'], displayLimit: 4 } },
  { id: 'richtext:care', component: 'richtext', content: { title: '关怀说明', content: '所有商品以服务端资格、价格与库存为准。' } },
] };
