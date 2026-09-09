export interface MemberCodeModule {
  readonly key: string;
  readonly dark: boolean;
}

export interface MiniappMemberCode {
  readonly challenge: string;
  readonly version: number;
  readonly issuedAt: number;
  readonly expiresAt: number;
  readonly matrixSize: number;
  readonly modules: readonly MemberCodeModule[];
}

export interface MemberIdentity {
  readonly name: string;
  readonly mobileVerified: boolean;
  readonly welfareMinor: number;
  readonly mealMinor: number;
}

export function remainingSeconds(code: MiniappMemberCode, now: number): number {
  return Math.max(0, Math.ceil((code.expiresAt - now) / 1_000));
}

export function refreshWaitSeconds(code: MiniappMemberCode, now: number): number {
  return Math.max(0, Math.ceil((code.issuedAt + 10_000 - now) / 1_000));
}
