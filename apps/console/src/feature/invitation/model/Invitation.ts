import type { OperationOutputFor } from '@shop/contract';

export type InvitationPage = OperationOutputFor<'identity.invitations.read'>;
export type Invitation = InvitationPage['items'][number];
export type InvitationReceipt = OperationOutputFor<'identity.invitations.create'>;
export type InvitationRevocation = OperationOutputFor<'identity.invitations.revoke'>;

export interface InvitationFilter {
  readonly target?: 'console' | 'storefront';
  readonly status?: Invitation['status'];
  readonly kind?: Invitation['kind'];
  readonly cursor?: string;
}
