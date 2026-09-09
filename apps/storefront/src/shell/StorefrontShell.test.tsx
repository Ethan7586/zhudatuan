// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { useShellViewModel } from './ShellViewModel';
import { StorefrontShell } from './StorefrontShell';

vi.mock('./QuickView', () => ({ QuickView: ({ enabled }: { enabled: boolean }) => <span data-testid="quickview-state">{String(enabled)}</span> }));
vi.mock('../shared/view/ToastContainer', () => ({ ToastContainer: () => null }));

afterEach(cleanup);

describe('StorefrontShell', () => {
  it('renders configured brand, navigation, shortcuts and account actions', () => {
    const viewmodel = model();
    render(
      <StorefrontShell viewmodel={viewmodel}>
        <p>商城正文</p>
      </StorefrontShell>
    );

    expect(screen.getAllByText('员工关怀')).toHaveLength(2);
    expect(screen.getByLabelText('搜索商城商品')).toBeTruthy();
    expect(screen.getByLabelText('移动端搜索商城商品')).toBeTruthy();
    expect(screen.getByLabelText('客服中心')).toBeTruthy();
    expect(screen.getAllByLabelText('消息通知')).toHaveLength(2);
    expect(screen.getAllByLabelText('购物车，共 108 件')).toHaveLength(2);
    expect(screen.getByLabelText('王小明的账户菜单')).toBeTruthy();
    expect(screen.getByText('第二福利商城')).toBeTruthy();
    expect(screen.getByText('安全退出')).toBeTruthy();
    expect(screen.getByRole('navigation', { name: '移动端主要导航' })).toBeTruthy();
    expect(screen.getByTestId('quickview-state').textContent).toBe('true');

    fireEvent.click(screen.getByLabelText('客服中心'));
    fireEvent.click(screen.getByText('第二福利商城'));
    fireEvent.click(screen.getByText('安全退出'));
    fireEvent.submit(screen.getByLabelText('搜索商城商品').closest('form')!);
    expect(viewmodel.actions.navigate).toHaveBeenCalledWith('/support');
    expect(viewmodel.actions.switchMall).toHaveBeenCalledWith('membership:two');
    expect(viewmodel.actions.logout).toHaveBeenCalledOnce();
    expect(viewmodel.actions.search).toHaveBeenCalledWith('');
  });

  it('does not render capabilities missing from navigation configuration', () => {
    const viewmodel = model({ navigation: { primary: [], published: [], quick: [], mobile: [], search: false, quickView: false } });
    render(
      <StorefrontShell viewmodel={viewmodel}>
        <p>只读首页</p>
      </StorefrontShell>
    );

    expect(screen.queryByLabelText('搜索商城商品')).toBeNull();
    expect(screen.queryByLabelText('客服中心')).toBeNull();
    expect(screen.queryByLabelText(/购物车/)).toBeNull();
    expect(screen.getByTestId('quickview-state').textContent).toBe('false');
  });
});

function model(overrides: Record<string, unknown> = {}) {
  const mall = { id: 'mall:one', membershipId: 'membership:one', enterpriseId: 'enterprise:one', enterpriseName: '示例企业', mallName: '员工福利商城', logoText: '员工福利', badge: '当前商城', roleLabel: '企业员工', welcomeBanner: '欢迎' };
  return {
    brand: { name: mall.mallName, enterprise: mall.enterpriseName, badge: mall.badge },
    navigation: {
      primary: [{ id: 'home', label: '首页', path: '/' }],
      published: [{ id: 'festival', label: '员工关怀', path: '/pages/festival' }],
      quick: [
        { id: 'support', label: '客服中心', path: '/support', kind: 'support' },
        { id: 'notification', label: '消息通知', path: '/notifications', kind: 'notification' },
        { id: 'cart', label: '购物车', path: '/cart', kind: 'cart' },
        { id: 'account', label: '我的', path: '/profile', kind: 'account' },
      ],
      mobile: [
        { id: 'home', label: '首页', path: '/', kind: 'home' },
        { id: 'catalog', label: '分类', path: '/products', kind: 'catalog' },
        { id: 'benefit', label: '福利', path: '/benefits', kind: 'benefit' },
        { id: 'orders', label: '订单', path: '/orders', kind: 'orders' },
        { id: 'account', label: '我的', path: '/profile', kind: 'account' },
      ],
      search: true,
      quickView: true,
    },
    cartCount: 108,
    pathname: '/',
    account: { authenticated: true, name: '王小明', currentMall: mall, malls: [mall, { ...mall, id: 'mall:two', membershipId: 'membership:two', mallName: '第二福利商城', badge: '可切换' }] },
    toasts: [],
    removeToast: vi.fn(),
    actions: { navigate: vi.fn(), home: vi.fn(), catalog: vi.fn(), search: vi.fn(), switchMall: vi.fn(), logout: vi.fn(() => Promise.resolve()) },
    ...overrides,
  } as unknown as ReturnType<typeof useShellViewModel>;
}
