// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { ExperiencePage } from '@shop/contract';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { presentProduct } from '../../../entity/product';
import { productFixture, profileFixture } from '../../../../test/Fixture';
import type { useHomeViewModel } from '../viewmodel/HomeViewModel';
import { HomePage } from './HomePage';

afterEach(cleanup);

describe('HomePage approved storefront composition', () => {
  it('keeps the mobile information hierarchy and every shortcut connected to a real action', () => {
    const openFeature = vi.fn();
    const navigatePage = vi.fn();
    const switchMall = vi.fn();
    const product = presentProduct(productFixture({ title: '员工关怀礼盒', categoryId: 'category:care' }));
    const viewmodel = {
      user: profileFixture({ phoneVerified: false }),
      profileState: 'ready',
      profileMessage: null,
      retryProfile: vi.fn(),
      currentMall: mall('mall:one', 'membership:one', '智慧翼测试企业'),
      malls: [mall('mall:one', 'membership:one', '智慧翼测试企业'), mall('mall:two', 'membership:two', '智慧翼协作企业')],
      switchMall,
      presentationProducts: [product],
      presentationCategories: [{ id: 'category:care', code: 'care', name: '员工关怀', count: 1, iconName: 'Gift', description: '1 件可见商品' }],
      catalogState: 'ready',
      orders: [],
      orderState: 'ready',
      addToCart: vi.fn(),
      navigateAction: vi.fn(),
      navigatePage,
      showToast: vi.fn(),
      openFeature,
      openProduct: vi.fn(),
      openCategory: vi.fn(),
    } as unknown as ReturnType<typeof useHomeViewModel>;

    render(<HomePage viewmodel={viewmodel} page={page} />);

    const identity = screen.getByLabelText('当前企业福利商城');
    const mobile = document.querySelector<HTMLElement>('[data-home-layout="mobile"]');
    expect(mobile).not.toBeNull();
    const account = within(mobile!).getByRole('region', { name: '测试会员' });
    const shortcuts = screen.getByRole('navigation', { name: '商城快捷入口' });
    const hero = screen.getByRole('heading', { name: '员工专享福利季' });
    const scenes = screen.getByRole('heading', { name: '福利场景' });
    expect(follows(identity, account)).toBe(true);
    expect(follows(account, shortcuts)).toBe(true);
    expect(follows(shortcuts, hero)).toBe(true);
    expect(follows(hero, scenes)).toBe(true);
    expect(screen.getAllByRole('img', { name: '员工关怀礼盒' }).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: /福利账户/ }));
    fireEvent.click(screen.getByRole('button', { name: /电子卡券/ }));
    fireEvent.click(screen.getByRole('button', { name: /客服中心/ }));
    fireEvent.click(within(mobile!).getByRole('button', { name: /手机号尚未认证/ }));
    expect(openFeature.mock.calls).toEqual([['账户流水'], ['电子卡券'], ['客服中心'], ['账号安全']]);
    fireEvent.click(screen.getByRole('button', { name: /企业专区/ }));
    expect(navigatePage).toHaveBeenCalledWith('catalog');
    fireEvent.click(screen.getByRole('button', { name: /智慧翼协作企业/ }));
    expect(switchMall).toHaveBeenCalledWith('membership:two');
  });
});

const page: ExperiencePage = {
  id: 'page:home',
  path: 'home',
  blocks: [
    { id: 'hero:home', component: 'hero', content: { title: '员工专享福利季', subtitle: '企业福利，温暖抵达' } },
    { id: 'collection:home', component: 'productcollection', content: { title: '员工严选', listingIds: ['listing-one'] } },
  ],
};

function mall(id: string, membershipId: string, name: string) {
  return Object.freeze({ id, membershipId, enterpriseId: id, enterpriseName: name, mallName: `${name}福利商城`, logoText: name.slice(0, 4), badge: '当前商城', welcomeBanner: '企业福利已开放' });
}

function follows(before: HTMLElement, after: HTMLElement) {
  return Boolean(before.compareDocumentPosition(after) & Node.DOCUMENT_POSITION_FOLLOWING);
}
