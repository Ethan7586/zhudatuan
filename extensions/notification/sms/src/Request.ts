import { createHash, createHmac, randomUUID } from 'node:crypto';
import { HttpTransport, type Transport, type TransportRequest } from '@shop/sdk';
import type { SmsAccessCredential } from './Credential';

export interface SmsMessage {
  readonly phoneNumbers: string;
  readonly signName: string;
  readonly templateCode: string;
  readonly templateParam: string;
  readonly outId: string;
}

export async function sendAliyunSms(endpoint: string, message: SmsMessage, credential: SmsAccessCredential, signal: AbortSignal, transport: Transport = new HttpTransport()): Promise<string> {
  const response = await transport.send(createAliyunRequest(endpoint, message, credential, new Date(), randomUUID(), signal));
  const body = parseResponse(response.body);
  if (response.status < 200 || response.status >= 300 || body.Code !== 'OK' || !body.BizId) throw new Error(providerRejection(body.Code));
  return body.BizId;
}

export function createAliyunRequest(endpoint: string, message: SmsMessage, credential: SmsAccessCredential, now: Date, nonce: string, signal?: AbortSignal): TransportRequest {
  const query = canonicalQuery({ OutId: message.outId, PhoneNumbers: message.phoneNumbers, SignName: message.signName, TemplateCode: message.templateCode, TemplateParam: message.templateParam });
  const payloadHash = sha256('');
  const headers: Record<string, string> = {
    host: endpoint,
    'x-acs-action': 'SendSms',
    'x-acs-content-sha256': payloadHash,
    'x-acs-date': now.toISOString().replace(/\.\d{3}Z$/, 'Z'),
    'x-acs-signature-nonce': nonce,
    'x-acs-version': '2017-05-25',
  };
  if (credential.securityToken) headers['x-acs-security-token'] = credential.securityToken;
  const signedHeaders = Object.keys(headers).sort();
  const canonicalHeaders = signedHeaders.map((name) => `${name}:${headers[name]!.trim()}`).join('\n');
  const canonicalRequest = ['POST', '/', query, `${canonicalHeaders}\n`, signedHeaders.join(';'), payloadHash].join('\n');
  const signature = createHmac('sha256', credential.accessKeySecret)
    .update(`ACS3-HMAC-SHA256\n${sha256(canonicalRequest)}`)
    .digest('hex');
  headers.authorization = `ACS3-HMAC-SHA256 Credential=${credential.accessKeyId},SignedHeaders=${signedHeaders.join(';')},Signature=${signature}`;
  return Object.freeze({ url: `https://${endpoint}/?${query}`, method: 'POST', headers: Object.freeze(headers), ...(signal ? { signal } : {}) });
}

function canonicalQuery(values: Readonly<Record<string, string>>): string {
  return Object.keys(values)
    .sort()
    .map((key) => `${encode(key)}=${encode(values[key]!)}`)
    .join('&');
}

function encode(value: string): string {
  return encodeURIComponent(value)
    .replace(/!/g, '%21')
    .replace(/'/g, '%27')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29')
    .replace(/\*/g, '%2A');
}

function parseResponse(value: string): Readonly<{ Code?: string; BizId?: string }> {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return Object.freeze({});
    const source = parsed as Readonly<Record<string, unknown>>;
    return Object.freeze({ ...(typeof source.Code === 'string' ? { Code: source.Code } : {}), ...(typeof source.BizId === 'string' ? { BizId: source.BizId } : {}) });
  } catch {
    return Object.freeze({});
  }
}
function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
function providerRejection(value: string | undefined): string {
  const normalized = (value ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_.-]/g, '')
    .slice(0, 80);
  return normalized ? `ALIYUN_SMS_${normalized}` : 'ALIYUN_SMS_REJECTED';
}
