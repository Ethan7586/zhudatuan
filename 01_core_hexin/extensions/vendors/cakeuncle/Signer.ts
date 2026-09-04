import { createHash, timingSafeEqual } from 'node:crypto';

export type CakeuncleH5Parameter = string | number;

export function signCakeuncle(channelNo: string, channelKey: string, timestamp: string): string {
  required(channelNo, 'CAKEUNCLE_CHANNEL_NO_MISSING');
  required(channelKey, 'CAKEUNCLE_CHANNEL_KEY_MISSING');
  if (!/^\d{10,13}$/.test(timestamp)) throw new Error('CAKEUNCLE_TIMESTAMP_INVALID');
  const sha1 = digest('sha1', `channel_no${channelNo}timestamp${timestamp}${channelKey}`);
  return digest('md5', sha1);
}

export function verifyCakeuncleSignature(channelNo: string, channelKey: string, timestamp: string, signature: string): boolean {
  if (!/^[a-f\d]{32}$/i.test(signature)) return false;
  let expected: Buffer;
  try { expected = Buffer.from(signCakeuncle(channelNo, channelKey, timestamp), 'hex'); }
  catch { return false; }
  const actual = Buffer.from(signature, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function signCakeuncleH5(parameters: Readonly<Record<string, CakeuncleH5Parameter>>, channelKey: string): string {
  required(channelKey, 'CAKEUNCLE_CHANNEL_KEY_MISSING');
  const canonical = Object.entries(parameters).sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
    .map(([key, value]) => `${key}=${String(value)}`).join('&');
  if (!canonical) throw new Error('CAKEUNCLE_H5_PARAMETERS_MISSING');
  return digest('md5', canonical + channelKey);
}

export interface CakeuncleCardOrderSignatureInput {
  readonly action: string;
  readonly merchant: string;
  readonly orderId: string;
  readonly quantity: string | number;
  readonly type: string | number;
  readonly account?: string;
  readonly ip?: string;
}

export function signCakeuncleCardOrder(input: CakeuncleCardOrderSignatureInput, key: string): string {
  required(key, 'CAKEUNCLE_CARD_KEY_MISSING');
  const directCharge = input.account !== undefined || input.ip !== undefined;
  if (directCharge && (!input.account || !input.ip)) throw new Error('CAKEUNCLE_DIRECT_CHARGE_SIGNATURE_FIELDS_MISSING');
  return digest('md5', [input.action, input.merchant, input.orderId, input.quantity,
    ...(directCharge ? [input.account!, input.ip!] : []), input.type, key].map(String).join(''));
}

export class CakeuncleSigner {
  constructor(private readonly channelNo: string, private readonly channelKey: string) {}
  sign(timestamp: string): string { return signCakeuncle(this.channelNo, this.channelKey, timestamp); }
  verify(timestamp: string, signature: string): boolean {
    return verifyCakeuncleSignature(this.channelNo, this.channelKey, timestamp, signature);
  }
}

function digest(algorithm: 'sha1' | 'md5', value: string): string {
  return createHash(algorithm).update(value, 'utf8').digest('hex').toLowerCase();
}

function required(value: string, code: string): void {
  if (!value.trim()) throw new Error(code);
}
