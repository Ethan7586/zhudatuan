// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Button } from './Button';

afterEach(cleanup);

describe('Button', () => {
  it.each(['default', 'primary', 'strong', 'danger', 'quiet'] as const)('exposes the shared %s visual tone', (tone) => {
    render(<Button tone={tone}>确认操作</Button>);
    const button = screen.getByRole('button', { name: '确认操作' });
    expect(button.classList.contains('shopbutton')).toBe(true);
    expect(button.classList.contains(`shopbutton${tone}`)).toBe(true);
  });

  it('keeps a pending action disabled and announces its current label', () => {
    const press = vi.fn();
    render(<Button isPending onPress={press}>正在保存商城资料…</Button>);

    const button = screen.getByRole('button', { name: '正在保存商城资料…' });
    expect(button.getAttribute('data-pending')).toBe('true');
    expect(button.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(button);
    expect(press).not.toHaveBeenCalled();
  });

  it('does not truncate a long beginner-friendly action label in its accessible name', () => {
    const label = '确认资料无误并提交平台审核';
    render(<Button>{label}</Button>);
    expect(screen.getByRole('button', { name: label }).textContent).toBe(label);
  });
});
