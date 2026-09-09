import { randomUUID } from 'node:crypto';
import { PgRuntimeWriter } from '../../../../platform/database/PgRuntimeWriter';
import { PgTransactionAccess, type SqlExecutor } from '../../../../platform/database/PgTransactionAccess';
import { DomainError } from '../../../../platform/error/DomainError';
import type { WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import type { MemberAccessPort } from '../../../access/public';
import type { OrganizationReadPort } from '../../../organization/public';
import type { VerificationChannelPort } from '../../../notification/public';
import type { VerificationVoucherPort } from '../../../voucher/public';
import type { ChallengeRepository } from '../../application/port/ChallengeRepository';
import { Challenge } from '../../domain/model/Challenge';
import { VerificationAttempt, type VerificationAttemptResult } from '../../domain/model/VerificationAttempt';
import { VerificationSession, type VerificationPurpose, type VerificationSessionValue } from '../../domain/model/VerificationSession';
import { RatePolicy } from '../../domain/policy/RatePolicy';
import { VerificationPolicy } from '../../domain/policy/VerificationPolicy';

export interface SessionRow {
  readonly id: string;
  readonly scope_id: string;
  readonly subject_type: VerificationSessionValue['subjectType'];
  readonly subject_id: string;
  readonly purpose: VerificationPurpose;
  readonly operation_id: string;
  readonly channel: VerificationSessionValue['channel'];
  readonly state: VerificationSessionValue['state'];
  readonly attempts: number;
  readonly maximum_attempts: number;
  readonly issued_by: string;
  readonly issued_access_version: number;
  readonly created_at: Date;
  readonly expires_at: Date;
  readonly verified_at: Date | null;
  readonly revoked_at: Date | null;
  readonly revoke_reason: VerificationSessionValue['revokeReason'];
  readonly version: number;
}

export function restore(row: SessionRow): VerificationSession {
  return VerificationSession.restore({
    id: row.id,
    scope: row.scope_id,
    subjectType: row.subject_type,
    subject: row.subject_id,
    purpose: row.purpose,
    operation: row.operation_id,
    channel: row.channel,
    state: row.state,
    attempts: row.attempts,
    maximumAttempts: row.maximum_attempts,
    issuedBy: row.issued_by,
    issuedAccessVersion: row.issued_access_version,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    verifiedAt: row.verified_at,
    revokedAt: row.revoked_at,
    revokeReason: row.revoke_reason,
    version: row.version,
  });
}
