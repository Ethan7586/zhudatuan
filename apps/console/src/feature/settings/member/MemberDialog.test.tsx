import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemberDialog } from './MemberDialog';

afterEach(cleanup);

describe('MemberDialog', () => {
  it('identifies the selected member by account name and employee number', async () => {
    render(
      <MemberDialog
        member={{
          id: 'member:one',
          display_name: '李小明',
          status: 'active',
          membership_id: 'membership:internal-one',
          employee_no: 'E1002',
          membership_status: 'active',
          access_version: 3,
          joined_at: '2026-09-03T00:00:00.000Z',
        }}
        assurance={2}
        busy={false}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    expect(await screen.findByRole('dialog', { name: '编辑成员' })).toBeTruthy();
    expect(screen.getByText('李小明')).toBeTruthy();
    expect(screen.getByText('员工号 E1002')).toBeTruthy();
    expect(screen.queryByText('membership:internal-one')).toBeNull();
  });
});
