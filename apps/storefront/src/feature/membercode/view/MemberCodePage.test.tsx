// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { encodeMemberCode } from '@shop/contract';
import type { useMemberCodeViewModel } from '../viewmodel/MemberCodeViewModel';
import { MemberCodePage } from './MemberCodePage';

afterEach(cleanup);

describe('MemberCodePage', () => {
  it('renders a readable member identity while keeping the credential graphical', () => {
    const actions = actionFixture();
    const challenge = 'verification:11111111-1111-4111-8111-111111111111';
    const credential = encodeMemberCode({ challenge, token: 'A'.repeat(43) });
    render(<MemberCodePage viewmodel={viewModel({ actions, code: { challenge, credential, state: 'issued', issuedAt: '2026-09-10T03:00:00.000Z', expiresAt: '2026-09-10T03:00:45.000Z', version: 1 } })} />);

    expect(screen.getByText(/王小明 · 企业员工/)).toBeTruthy();
    expect(screen.getByRole('img', { name: '动态会员二维码' })).toBeTruthy();
    expect(document.body.textContent).not.toContain(credential);
    expect(document.body.textContent).not.toContain(challenge);

    fireEvent.click(screen.getByRole('tab', { name: '条形码' }));
    fireEvent.click(screen.getByRole('button', { name: '高亮显示' }));
    fireEvent.click(screen.getByRole('button', { name: '暂时隐藏' }));
    expect(actions.display).toHaveBeenCalledWith('barcode');
    expect(actions.brightness).toHaveBeenCalledOnce();
    expect(actions.hide).toHaveBeenCalledOnce();
  });

  it('guides an unverified member to the security center', () => {
    const actions = actionFixture();
    render(<MemberCodePage viewmodel={viewModel({ state: 'needsmobile', code: null, actions, user: { ...user, phoneVerified: false } })} />);
    fireEvent.click(screen.getByRole('button', { name: '前往安全中心' }));
    expect(actions.verifyMobile).toHaveBeenCalledOnce();
  });
});

const user = Object.freeze({
  id: 'member:one', employeeNumber: null, name: '王小明', avatar: '', phone: '已绑定', jobTitle: '', department: '智慧翼测试企业', enterpriseId: 'enterprise:one', enterpriseName: '智慧翼测试企业',
  currentMallId: 'mall:one', welfareBalanceMinor: 500_00, mealBalanceMinor: 120_00, couponCount: 3, assuranceLevel: 'phone' as const, phoneVerified: true, paymentEligible: true,
  accessVersion: 2, locale: 'zh-CN', timezone: 'Asia/Shanghai', marketingAllowed: false, preferenceVersion: 1,
});

function actionFixture() {
  return { refresh: vi.fn(), retry: vi.fn(), hide: vi.fn(), show: vi.fn(), verifyMobile: vi.fn(), closeVerification: vi.fn(), verified: vi.fn(), display: vi.fn(), brightness: vi.fn() };
}

function viewModel(overrides: Record<string, unknown> = {}) {
  return {
    state: 'ready', code: null, remaining: 32, duration: 45, refreshWait: 0, busy: false, error: null, verification: false, display: 'qrcode', bright: false, user,
    currentMall: { id: 'mall:one', membershipId: 'membership:one', enterpriseId: 'enterprise:one', enterpriseName: '智慧翼测试企业', mallName: '智慧翼测试企业福利商城', logoText: '智慧翼', badge: '当前商城', roleLabel: '企业员工', welcomeBanner: '欢迎' },
    actions: actionFixture(),
    ...overrides,
  } as unknown as ReturnType<typeof useMemberCodeViewModel>;
}
