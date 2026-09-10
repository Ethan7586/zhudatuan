import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Invitation } from '../model/Invitation';
import { InvitationRevokeDialog } from './InvitationRevokeDialog';

describe('InvitationRevokeDialog', () => {
  it('identifies the invitation by scenario and recipient instead of its internal id', () => {
    render(<InvitationRevokeDialog invitation={invitation} busy={false} onClose={vi.fn()} onSubmit={vi.fn()} />);

    expect(screen.getByText('指定员工注册 · 张三')).toBeTruthy();
    expect(screen.queryByText(invitation.id)).toBeNull();
  });
});

const invitation: Invitation = {
  id: 'invitation:internal:one',
  kind: 'enrollment',
  target: 'storefront',
  organizationId: 'mall:one',
  membershipId: null,
  recipientDisplayName: '张三',
  recipientEmployeeNo: 'E001',
  recipientMobileMasked: '138****8000',
  issuerMembershipId: 'membership:owner',
  issuerDisplayName: '李主管',
  issuerEmployeeNo: 'M001',
  issuerMobileMasked: '139****9000',
  issuerAccessVersion: 3,
  minimumAssurance: 2,
  maxUses: 1,
  useCount: 0,
  notBefore: '2026-09-10T00:00:00.000Z',
  expiresAt: '2026-09-13T00:00:00.000Z',
  status: 'active',
  reason: '邀请新员工完成注册',
  createdAt: '2026-09-10T00:00:00.000Z',
  revokedAt: null,
  revokedBy: null,
  revokeReason: null,
  version: 1,
};
