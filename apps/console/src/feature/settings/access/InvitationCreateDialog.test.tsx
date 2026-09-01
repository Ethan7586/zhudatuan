import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { InvitationCreateDialog } from './InvitationCreateDialog';

afterEach(cleanup);

describe('InvitationCreateDialog', () => {
  it('offers campaign enrollment only from a mall scope', () => {
    const props = {
      open: true,
      memberships: [],
      scope: 'mall-zhudatuan',
      busy: false,
      onClose: vi.fn(),
      onSubmit: vi.fn(),
    } as const;
    const view = render(<InvitationCreateDialog {...props} scopeKind="mall" />);
    expect(screen.getByRole('option', { name: '活动邀请' })).toBeTruthy();

    view.rerender(<InvitationCreateDialog {...props} scope="enterprise-zhudatuan" scopeKind="enterprise" />);
    expect(screen.queryByRole('option', { name: '活动邀请' })).toBeNull();
  });
});
