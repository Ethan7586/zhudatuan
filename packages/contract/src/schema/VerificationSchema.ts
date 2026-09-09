import { literal, null as nullSchema, optional, strictObject, string, union } from 'zod/mini';
import { isoUtc, pageOutput, pageQuery, version } from './Primitives';

const nullableText = union([string(), nullSchema()]);
const purpose = literal(['member_code', 'voucher_redeem', 'login', 'sensitive_action', 'financial_approval']);
const session = strictObject({ id: string(), subject_type: literal(['member', 'voucher', 'principal', 'resource']), subject_id: string(), purpose,
  operation_id: string(), channel: literal(['qrcode', 'sms', 'app']), state: literal(['issued', 'verified', 'expired', 'revoked', 'locked']),
  attempts: version, maximum_attempts: version, expires_at: isoUtc, verified_at: nullableText, version });
const memberCode = strictObject({ id: string(), state: literal(['issued', 'expired', 'revoked']), issued_at: isoUtc, expires_at: isoUtc, version });
const device = strictObject({ id: string(), label: string(), status: literal(['trusted', 'blocked', 'retired']), last_used_at: nullableText, version });

export const VERIFICATION_BODY_SCHEMAS = {
  VerificationChallengesIssueInput: strictObject({ purpose: optional(purpose), voucher: optional(string()) }),
  VerificationMemberCodesIssueInput: strictObject({}),
  VerificationMemberCodesRevokeInput: strictObject({}),
  VerificationChallengesVerifyInput: strictObject({ token: string(), device: string() }),
  VerificationDevicesManageInput: strictObject({ label: string(), fingerprint: string(), publicKey: optional(nullableText), status: optional(literal(['trusted', 'blocked', 'retired'])) }),
} as const;

export const VERIFICATION_QUERY_SCHEMAS = {
  VerificationSessionsReadInput: strictObject(pageQuery),
  VerificationHistoryReadInput: strictObject(pageQuery),
  VerificationDevicesReadInput: strictObject(pageQuery),
} as const;

export const VERIFICATION_OUTPUT_SCHEMAS = {
  VerificationChallengesIssueOutput: strictObject({ ...session.shape, token: string() }),
  VerificationMemberCodesIssueOutput: strictObject({ ...memberCode.shape, token: string() }),
  VerificationMemberCodesRevokeOutput: memberCode,
  VerificationSessionsReadOutput: pageOutput(session),
  VerificationChallengesVerifyOutput: strictObject({ record: string(), verified: literal(true), subjectType: literal(['member', 'voucher', 'principal', 'resource']), subject: string(), purpose,
    operation: string(), proof: string(), proofExpiresAt: isoUtc }),
  VerificationHistoryReadOutput: pageOutput(
    strictObject({
      id: string(),
      session_id: string(),
      sequence: version,
      scope_id: string(),
      subject_type: literal(['member', 'voucher', 'principal', 'resource']),
      subject_id: string(),
      purpose,
      operation_id: string(),
      actor_id: string(),
      device_id: nullableText,
      result: literal(['accepted', 'rejected', 'replayed', 'expired']),
      reason: string(),
      attempted_at: isoUtc,
    })
  ),
  VerificationDevicesReadOutput: pageOutput(device),
  VerificationDevicesManageOutput: device,
} as const;
