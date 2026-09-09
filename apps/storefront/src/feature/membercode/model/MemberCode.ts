import type { OperationOutputFor } from '@shop/contract';

type MemberCodeState = OperationOutputFor<'verification.membercodes.issue'>['state'];

export interface MemberCode {
  readonly challenge: string;
  readonly credential: string;
  readonly state: MemberCodeState;
  readonly issuedAt: string;
  readonly expiresAt: string;
  readonly version: number;
}

export function memberCodeRemaining(code: MemberCode, now: number): number {
  return Math.max(0, Math.ceil((Date.parse(code.expiresAt) - now) / 1_000));
}

export function memberCodeRefreshWait(code: MemberCode, now: number): number {
  return Math.max(0, Math.ceil((Date.parse(code.issuedAt) + 10_000 - now) / 1_000));
}
