// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ProviderList } from '../../src/feature/federation/view/ProviderList';

describe('federation journey', () => {
  it('distinguishes loading, missing and selectable provider states', async () => {
    const { rerender } = render(<ProviderList providers={[]} busy={false} loading failed={false} onSelect={vi.fn()} />);
    expect(screen.getByRole('status').textContent).toContain('正在加载');
    rerender(<ProviderList providers={[]} busy={false} loading={false} failed={false} onSelect={vi.fn()} />);
    expect(screen.getByText(/没有配置企业单点登录/)).toBeTruthy();
    const select = vi.fn();
    const provider = { id: 'provider-1', type: 'oidc' as const };
    rerender(<ProviderList providers={[provider]} busy={false} loading={false} failed={false} onSelect={select} />);
    await userEvent.click(screen.getByRole('button', { name: '企业单点登录' }));
    expect(select).toHaveBeenCalledWith(provider);
  });

  it('leaves the provider area empty when an independent error owns its alert', () => {
    const { container } = render(<ProviderList providers={[]} busy={false} loading={false} failed onSelect={vi.fn()} />);
    expect(container.childElementCount).toBe(0);
  });
});
