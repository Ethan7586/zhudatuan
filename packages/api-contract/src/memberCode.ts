export const MEMBER_CODE_PROTOCOL = 'smartwing-member-code:v1:';
export const MEMBER_CODE_VALID_SECONDS = 45;

export interface MemberCodeChallengeResponse {
  challengeId: string;
  payload: string;
  matrix: boolean[][];
  issuedAt: string;
  expiresAt: string;
  validSeconds: typeof MEMBER_CODE_VALID_SECONDS;
  requestId: string;
}

export interface MemberCodeVerificationResponse {
  verified: boolean;
  challengeId?: string;
  memberId?: string;
  membershipId?: string;
  consumedAt?: string;
  code?: string;
  requestId: string;
}
