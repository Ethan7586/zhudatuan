import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Header, type HeaderProps } from './Header';

afterEach(cleanup);

describe('Header secondary verification', () => {
  it('opens secondary verification for a base session', () => {
    const onStepup = vi.fn();
    render(<Header {...props({ assuranceLevel: 2, onStepup })} />);
    fireEvent.click(screen.getByLabelText('打开 测试用户 的账户菜单'));
    fireEvent.click(screen.getByRole('button', { name: '开启二次验证' }));
    expect(onStepup).toHaveBeenCalledExactlyOnceWith();
  });

  it('closes an elevated session', () => {
    const onDisableStepup = vi.fn();
    render(<Header {...props({ assuranceLevel: 3, onDisableStepup })} />);
    fireEvent.click(screen.getByLabelText('打开 测试用户 的账户菜单'));
    fireEvent.click(screen.getByRole('button', { name: '关闭二次验证' }));
    expect(onDisableStepup).toHaveBeenCalledExactlyOnceWith();
  });
});

function props(overrides: Partial<HeaderProps> = {}): HeaderProps {
  return {
    title: '控制台',
    summary: '已授权工作区',
    scopeLabel: '集团 · 测试集团',
    displayName: '测试用户',
    assuranceLevel: 2,
    syncedAt: '2026-09-01T00:00:00Z',
    loggingOut: false,
    disablingStepup: false,
    onStepup: vi.fn(),
    onDisableStepup: vi.fn(),
    onLogout: vi.fn(),
    onOpenNavigation: vi.fn(),
    ...overrides,
  };
}
