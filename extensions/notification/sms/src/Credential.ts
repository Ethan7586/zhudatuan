import { HttpTransport, type Transport } from '@shop/sdk';
import type { SmsCredential } from './Config';

export interface SmsAccessCredential extends SmsCredential {
  readonly securityToken?: string;
}
export interface SmsCredentialProvider {
  resolve(signal: AbortSignal): Promise<SmsAccessCredential>;
}

export class StaticCredentialProvider implements SmsCredentialProvider {
  constructor(private readonly credential: SmsCredential) {}
  resolve(): Promise<SmsAccessCredential> {
    return Promise.resolve(this.credential);
  }
}

export class EcsCredentialProvider implements SmsCredentialProvider {
  private cached: Readonly<{ credential: SmsAccessCredential; expiresAt: number }> | null = null;
  constructor(
    private readonly roleName: string,
    private readonly transport: Transport = new HttpTransport()
  ) {}

  async resolve(signal: AbortSignal): Promise<SmsAccessCredential> {
    if (this.cached && this.cached.expiresAt - Date.now() > 300_000) return this.cached.credential;
    const tokenResponse = await this.transport.send({ url: 'http://100.100.100.200/latest/api/token', method: 'PUT', headers: { 'x-aliyun-ecs-metadata-token-ttl-seconds': '21600' }, signal });
    const token = tokenResponse.body.trim();
    if (tokenResponse.status !== 200 || !token) throw new Error('ALIYUN_SMS_CREDENTIAL_UNAVAILABLE');
    const response = await this.transport.send({
      url: `http://100.100.100.200/latest/meta-data/ram/security-credentials/${encodeURIComponent(this.roleName)}`,
      method: 'GET',
      headers: { 'x-aliyun-ecs-metadata-token': token },
      signal,
    });
    if (response.status !== 200) throw new Error('ALIYUN_SMS_CREDENTIAL_UNAVAILABLE');
    const metadata = parseMetadataCredential(response.body);
    const credential = Object.freeze({ accessKeyId: metadata.accessKeyId, accessKeySecret: metadata.accessKeySecret, securityToken: metadata.securityToken });
    this.cached = Object.freeze({ credential, expiresAt: Date.parse(metadata.expiration) });
    return credential;
  }
}

interface MetadataCredential extends SmsCredential {
  readonly securityToken: string;
  readonly expiration: string;
}
function parseMetadataCredential(value: string): MetadataCredential {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error('ALIYUN_SMS_CREDENTIAL_INVALID');
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('ALIYUN_SMS_CREDENTIAL_INVALID');
  const source = parsed as Readonly<Record<string, unknown>>;
  const accessKeyId = text(source.AccessKeyId);
  const accessKeySecret = text(source.AccessKeySecret);
  const securityToken = text(source.SecurityToken);
  const expiration = text(source.Expiration);
  if (source.Code !== 'Success' || !accessKeyId || !accessKeySecret || !securityToken || !expiration || !Number.isFinite(Date.parse(expiration))) throw new Error('ALIYUN_SMS_CREDENTIAL_INVALID');
  return Object.freeze({ accessKeyId, accessKeySecret, securityToken, expiration });
}
function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}
