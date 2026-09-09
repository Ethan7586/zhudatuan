import { encodeMemberCode } from '@shop/contract/verification';
import type { OperationOutputFor } from '@shop/contract';
import type { MemberCode } from '../model/MemberCode';

export function mapMemberCode(value: OperationOutputFor<'verification.membercodes.issue'>): MemberCode {
  const issuedAt = Date.parse(value.issued_at);
  const expiresAt = Date.parse(value.expires_at);
  if (value.state !== 'issued' || !Number.isFinite(issuedAt) || !Number.isFinite(expiresAt) || expiresAt <= issuedAt) throw new Error('MEMBER_CODE_RESPONSE_INVALID');
  return Object.freeze({
    challenge: value.id,
    credential: encodeMemberCode({ challenge: value.id, token: value.token }),
    state: value.state,
    issuedAt: value.issued_at,
    expiresAt: value.expires_at,
    version: Number(value.version),
  });
}
