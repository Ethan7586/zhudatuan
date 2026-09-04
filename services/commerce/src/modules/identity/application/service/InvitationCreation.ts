import type { IdentityInvitationsCreateBody } from '@shop/contract';
import type { OperationResult } from '../../../../foundation/application/OperationRequest';
import { DomainError } from '../../../../foundation/domain/DomainError';
import type { InvitationDigest } from '../port/InvitationSecurity';
import type { PreparedEmployeeInvitation } from './PrepareEmployeeInvitation';
import type { OneTimeInvitationCode } from './PrepareEmployeeInvitation';

type SharedInvitationFields = Readonly<{
  readonly invitation: string;
  readonly token: InvitationDigest;
  readonly code: OneTimeInvitationCode;
  readonly expiresAt: Date;
  readonly reason: string;
  readonly principal: string | null;
  readonly recipientHash: Buffer | null;
}>;

type PreparedSharedInvitation =
  | (SharedInvitationFields & Readonly<{ kind: 'campaign'; body: Extract<IdentityInvitationsCreateBody, Readonly<{ kind: 'campaign' }>> }>)
  | (SharedInvitationFields & Readonly<{ kind: 'signin'; body: Extract<IdentityInvitationsCreateBody, Readonly<{ kind: 'signin' }>> }>);

export type PreparedInvitation = PreparedEmployeeInvitation | PreparedSharedInvitation;
export type LoadedInvitation = Readonly<{ kind: 'none' }> | Readonly<{ kind: 'signin'; principal: string; mobileCiphertext: string }>;

type InvitationReceiptRow = Readonly<{
  id: string;
  kind: 'signin' | 'enrollment' | 'campaign';
  target: 'console' | 'storefront';
  organization_id: string;
  membership_id: string | null;
  max_uses: number;
  use_count: number;
  expires_at: string;
  status: string;
  version: number;
}>;

export function invitationReceipt(
  row: InvitationReceiptRow,
  code: string,
  recipientMasked?: string,
  employee?: Readonly<{ displayName: string; employeeNo?: string }>
): OperationResult {
  if (row.status !== 'active') throw new Error('INVITATION_ACTIVATION_FAILED');
  return {
    status: 201,
    body: {
      id: row.id,
      kind: row.kind,
      target: row.target,
      status: 'active',
      code,
      organizationId: row.organization_id,
      ...(row.membership_id === null ? {} : { membershipId: row.membership_id }),
      ...(recipientMasked === undefined ? {} : { recipientMasked }),
      ...(employee === undefined ? {} : { employee }),
      maxUses: row.max_uses,
      useCount: row.use_count,
      expiresAt: row.expires_at,
      version: row.version,
    },
    headers: { etag: `"${String(row.version)}"` },
  };
}

export function invitationExpiry(value: string): Date {
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) throw new DomainError('VALIDATION_FAILED', { field: 'expiresAt' });
  return parsed;
}

export function invitationText(value: string, field: string, minimum: number, maximum: number): string {
  const normalized = value.trim();
  if (normalized.length < minimum || normalized.length > maximum) throw new DomainError('VALIDATION_FAILED', { field });
  return normalized;
}
