import { exactOperationOutput } from '@shop/contract/schema';

export const InvitationPageSchema = exactOperationOutput('IdentityInvitationsReadOutput');
export const InvitationReceiptSchema = exactOperationOutput('IdentityInvitationsCreateOutput');
export const InvitationRevocationSchema = exactOperationOutput('IdentityInvitationsRevokeOutput');
export const InvitationMembershipPageSchema = exactOperationOutput('AccessCenterReadOutput');
