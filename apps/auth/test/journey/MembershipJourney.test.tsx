// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MembershipList } from '../../src/feature/membership/ui/MembershipList';
import { membership } from '../TestData';

describe('membership journey', () => {
  it('shows human-readable organization, role and person data before selection', async () => {
    const select = vi.fn();
    render(<MembershipList memberships={[membership]} busy={false} onSelect={select} />);
    expect(screen.getByText('示例企业')).toBeTruthy();
    expect(screen.getByText(/员工 · 福利商城/)).toBeTruthy();
    expect(screen.getByText('测试员工')).toBeTruthy();
    await userEvent.click(screen.getByRole('button'));
    expect(select).toHaveBeenCalledWith(membership);
  });

  it('explains an empty selection without exposing internal identifiers', () => {
    render(<MembershipList memberships={[]} busy={false} onSelect={vi.fn()} />);
    expect(screen.getByText(/没有可用的企业福利或运营身份/)).toBeTruthy();
  });
});
