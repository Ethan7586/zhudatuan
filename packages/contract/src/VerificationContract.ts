export const MEMBER_CODE_SECONDS = 60;

export interface VerificationChallenge {
  readonly challenge: string;
  readonly expires: string;
  readonly payload: string;
}

export interface VerificationResult {
  readonly record: string;
  readonly accepted: boolean;
  readonly reason?: string;
}
