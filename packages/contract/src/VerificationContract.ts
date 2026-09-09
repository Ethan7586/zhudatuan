export const MEMBER_CODE_PROTOCOL = 'smartwing-member-code:v1:' as const;
export const MEMBER_CODE_SECONDS = 45 as const;

export interface MemberCodeCredential {
  readonly challenge: string;
  readonly token: string;
}

export function encodeMemberCode(value: MemberCodeCredential): string {
  if (!validChallenge(value.challenge) || !validToken(value.token)) throw new Error('MEMBER_CODE_CREDENTIAL_INVALID');
  return `${MEMBER_CODE_PROTOCOL}${value.challenge}.${value.token}`;
}

export function parseMemberCode(value: string): MemberCodeCredential | null {
  if (!value.startsWith(MEMBER_CODE_PROTOCOL)) return null;
  const credential = value.slice(MEMBER_CODE_PROTOCOL.length);
  const separator = credential.lastIndexOf('.');
  if (separator < 1) return null;
  const challenge = credential.slice(0, separator);
  const token = credential.slice(separator + 1);
  return validChallenge(challenge) && validToken(token) ? Object.freeze({ challenge, token }) : null;
}

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

function validChallenge(value: string): boolean {
  return /^verification:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function validToken(value: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(value);
}
