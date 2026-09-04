export interface CakeuncleCredential {
  readonly channelNo: string;
  readonly channelKey: string;
  readonly userId?: string;
}

export function createCakeuncleAuth(secret: Readonly<Record<string, string>>): CakeuncleCredential {
  const channelNo = required(secret, 'channelNo', 'CAKEUNCLE_CHANNEL_NO_MISSING');
  const channelKey = required(secret, 'channelKey', 'CAKEUNCLE_CHANNEL_KEY_MISSING');
  const userId = secret.userId?.trim();
  return Object.freeze({ channelNo, channelKey, ...(userId ? { userId } : {}) });
}

export function requireCakeuncleUserId(credential: CakeuncleCredential): string {
  if (!credential.userId) throw new Error('CAKEUNCLE_USER_ID_MISSING');
  return credential.userId;
}

function required(source: Readonly<Record<string, string>>, key: string, code: string): string {
  const value = source[key]?.trim();
  if (!value) throw new Error(code);
  return value;
}
