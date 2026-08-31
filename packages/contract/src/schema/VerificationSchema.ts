import { literal, null as nullSchema, optional, strictObject, string, union } from 'zod/mini';
import { isoUtc, pageOutput, pageQuery, version } from './Primitives';

const nullableText = union([string(), nullSchema()]);
const purpose = literal(['member_code', 'voucher_redeem']);
const session = strictObject({ id: string(), subject_type: literal(['member', 'voucher']), subject_id: string(), purpose, state: literal(['issued', 'verified', 'expired', 'revoked', 'locked']), expires_at: isoUtc, version });
const device = strictObject({ id: string(), label: string(), status: literal(['trusted', 'blocked', 'retired']), version });

export const VERIFICATION_BODY_SCHEMAS = {
  VerificationChallengesIssueInput: strictObject({ purpose: optional(purpose), voucher: optional(string()) }),
  VerificationChallengesVerifyInput: strictObject({ nonce: string(), device: string() }),
  VerificationDevicesManageInput: strictObject({ label: string(), fingerprint: string(), publicKey: optional(nullableText), status: optional(literal(['trusted', 'blocked', 'retired'])) }),
} as const;

export const VERIFICATION_QUERY_SCHEMAS = {
  VerificationSessionsReadInput: strictObject(pageQuery),
  VerificationHistoryReadInput: strictObject(pageQuery),
  VerificationDevicesReadInput: strictObject(pageQuery),
} as const;

export const VERIFICATION_OUTPUT_SCHEMAS = {
  VerificationChallengesIssueOutput: strictObject({ ...session.shape, nonce: string() }),
  VerificationSessionsReadOutput: pageOutput(session),
  VerificationChallengesVerifyOutput: strictObject({ record: string(), verified: literal(true), subjectType: literal(['member', 'voucher']), subject: string(), purpose }),
  VerificationHistoryReadOutput: pageOutput(
    strictObject({
      id: string(),
      session_id: string(),
      subject_type: literal(['member', 'voucher']),
      subject_id: string(),
      purpose,
      device_id: nullableText,
      result: literal(['accepted', 'rejected', 'replayed', 'expired']),
      reason: string(),
      attempted_at: isoUtc,
    })
  ),
  VerificationDevicesReadOutput: pageOutput(device),
  VerificationDevicesManageOutput: device,
} as const;
