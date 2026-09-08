import type { ReadTransactionContext, WriteTransactionContext } from '../../../../platform/database/TransactionContext';

import type { Invitation, InvitationKind, InvitationStatus, InvitationTarget } from '../../domain/model/Invitation';
import type { InvitationClaim } from '../../domain/model/InvitationClaim';
import type { InvitationReceipt } from '../../domain/model/InvitationReceipt';
import type { InvitationDigest } from './InvitationSecurity';

export interface NewInvitation {
  readonly id: string;
  readonly kind: 'signin' | 'enrollment' | 'campaign';
  readonly target: 'console' | 'storefront' | 'miniapp' | 'store' | 'supplier';
  readonly organization: string;
  readonly membership: string | null;
  readonly principal: string | null;
  readonly recipientHash: Buffer | null;
  readonly token: InvitationDigest;
  readonly issuer: string;
  readonly issuerAccessVersion: number;
  readonly grantDigest: string;
  readonly assurance: 1 | 2 | 3;
  readonly maxUses: number;
  readonly expiresAt: Date;
  readonly policy: string | null;
  readonly termsHash: string | null;
  readonly reason: string;
}

export interface InvitationFilter {
  readonly scope: string;
  readonly target: 'console' | 'storefront' | 'miniapp' | 'store' | 'supplier' | null;
  readonly kind: 'signin' | 'enrollment' | 'campaign' | null;
  readonly status: 'draft' | 'active' | 'exhausted' | 'revoked' | 'expired' | null;
  readonly cursor: string | null;
  readonly limit: number;
}

export interface InvitationCreatedRecord {
  readonly id: string;
  readonly kind: InvitationKind;
  readonly target: InvitationTarget;
  readonly organization_id: string;
  readonly membership_id: string | null;
  readonly minimum_assurance: 1 | 2 | 3;
  readonly max_uses: number;
  readonly use_count: number;
  readonly not_before: string;
  readonly expires_at: string;
  readonly status: InvitationStatus;
  readonly reason: string;
  readonly created_at: string;
  readonly version: number;
}

export interface InvitationListRecord extends InvitationCreatedRecord {
  readonly recipient_display_name: string | null;
  readonly recipient_employee_no: string | null;
  readonly recipient_mobile_masked: string | null;
  readonly issuer_membership_id: string;
  readonly issuer_display_name: string;
  readonly issuer_employee_no: string | null;
  readonly issuer_mobile_masked: string | null;
  readonly issuer_access_version: number;
  readonly revoked_at: string | null;
  readonly revoked_by: string | null;
  readonly revoke_reason: string | null;
}

export interface InvitationReadRecord extends InvitationCreatedRecord {
  readonly issuer_membership_id: string;
  readonly issuer_access_version: number;
  readonly revoked_at: string | null;
  readonly revoked_by: string | null;
  readonly revoke_reason: string | null;
}

export interface InvitationRevokedRecord {
  readonly id: string;
  readonly kind: InvitationKind;
  readonly target: InvitationTarget;
  readonly status: 'revoked';
  readonly revoked_at: string;
  readonly revoked_by: string;
  readonly revoke_reason: string;
  readonly version: number;
}

export interface InvitationRepository {
  find(context: ReadTransactionContext, hashes: readonly InvitationDigest[], target: 'console' | 'storefront' | 'miniapp' | 'store' | 'supplier'): Promise<Invitation>;
  lock(context: WriteTransactionContext, hashes: readonly InvitationDigest[], target: 'console' | 'storefront' | 'miniapp' | 'store' | 'supplier'): Promise<Invitation>;
  claimed(context: ReadTransactionContext, claim: string, target: 'console' | 'storefront' | 'miniapp' | 'store' | 'supplier'): Promise<Invitation>;
  lockClaimed(context: WriteTransactionContext, claim: string, target: 'console' | 'storefront' | 'miniapp' | 'store' | 'supplier'): Promise<Invitation>;
  claim(context: WriteTransactionContext, id: string): Promise<InvitationClaim>;
  bindRecipient(context: WriteTransactionContext, id: string, recipient: Buffer): Promise<InvitationClaim>;
  create(context: WriteTransactionContext, invitation: NewInvitation): Promise<InvitationCreatedRecord>;
  read(context: ReadTransactionContext, filter: InvitationFilter): Promise<readonly InvitationReadRecord[]>;
  revoke(context: WriteTransactionContext, id: string, actor: string, reason: string, version: number): Promise<InvitationRevokedRecord>;
  reserve(
    context: WriteTransactionContext,
    invitation: Invitation,
    input: Readonly<{
      claim: string;
      preauth: Buffer;
      browser: Buffer;
      device: Buffer;
      recipient: Buffer | null;
      principal: string | null;
      proof: 'otp' | 'sso' | 'terms';
      state: 'reserved' | 'proofpending';
      authorization: Readonly<{ stateHash: string; nonceHash: string; challenge: string }>;
      returnTarget: string;
    }>
  ): Promise<InvitationClaim>;
  consume(context: WriteTransactionContext, invitation: Invitation, input: Readonly<{ session: string | null; assurance: 1 | 2 | 3; trace: string; principal?: string; membership?: string }>): Promise<InvitationReceipt>;
  consumeClaim(context: WriteTransactionContext, claim: string, version: number): Promise<void>;
}
