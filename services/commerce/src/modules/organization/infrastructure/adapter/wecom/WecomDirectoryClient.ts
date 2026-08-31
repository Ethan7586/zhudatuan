import { DomainError } from '../../../../../foundation/domain/DomainError';
import { WECOM_PROVIDER_CONFIGURATION } from '@shop/config/server';
import type { SecretStore } from '../../../../../foundation/infrastructure/SecretStore';
import { providerCredential } from '../../../../../foundation/infrastructure/ProviderSecret';
import { HttpClient } from '../../../../../foundation/http/HttpClient';
import { Singleflight } from '../../../../../foundation/performance/Singleflight';
import type { DirectoryConnection } from '../../../domain/model/DirectoryConnection';

export interface WecomDirectoryPayload {
  readonly tenant: string;
  readonly departments: readonly Record<string, unknown>[];
  readonly users: readonly Record<string, unknown>[];
  readonly offset: number;
  readonly complete: boolean;
  readonly version: number;
}

export class WecomDirectoryClient {
  private readonly http: HttpClient;
  private readonly flights = new Singleflight();
  private readonly tokens = new Map<string, Readonly<{ value: string; expires: number }>>();
  constructor(
    private readonly secrets: SecretStore,
    fetcher: typeof fetch = fetch
  ) {
    this.http = new HttpClient(fetcher);
  }
  async page(connection: DirectoryConnection, cursor: string | null, signal: AbortSignal): Promise<WecomDirectoryPayload> {
    const credentials = await providerCredential(this.secrets, connection.secretref);
    const offset = decodeCursor(cursor);
    const token = connection.providertype === 'wecomsuite' && credentials.token ? credentials.token : await this.token(connection, credentials.tenant, credentials.secret, signal);
    const departments = offset === 0 ? await this.departments(token, signal) : [];
    const users = await this.users(token, offset, signal);
    const complete = users.length < WECOM_PROVIDER_CONFIGURATION.pageSize;
    return Object.freeze({ tenant: credentials.tenant, departments: Object.freeze(departments), users: Object.freeze(users), offset, complete, version: Math.floor(Date.now() / 1000) });
  }
  async webhookMaterial(connection: DirectoryConnection): Promise<Readonly<{ token: string; aeskey: string; recipient: string }>> {
    const value = await providerCredential(this.secrets, connection.secretref);
    if (!value.token || !value.aeskey || value.aeskey.length !== 43) throw new DomainError('IDENTITY_PROVIDER_CONFIGURATION_INVALID');
    return Object.freeze({ token: value.token, aeskey: value.aeskey, recipient: value.suiteid ?? value.tenant });
  }
  private async token(connection: DirectoryConnection, tenant: string, secret: string, signal: AbortSignal): Promise<string> {
    const cached = this.tokens.get(connection.id);
    if (cached && cached.expires > Date.now()) return cached.value;
    return this.flights.run(
      connection.id,
      async () => {
        const url = new URL(WECOM_PROVIDER_CONFIGURATION.corp.token);
        url.searchParams.set('corpid', tenant);
        url.searchParams.set('corpsecret', secret);
        const response = await this.http.send(url, { headers: { accept: 'application/json' } }, { mode: 'read', signal });
        const body = (await response.json()) as Record<string, unknown>;
        if (!response.ok || body.errcode !== 0 || typeof body.access_token !== 'string' || typeof body.expires_in !== 'number') throw new Error('DIRECTORY_PROVIDER_UNAVAILABLE');
        const value = Object.freeze({ value: body.access_token, expires: Date.now() + Math.max(60, body.expires_in - WECOM_PROVIDER_CONFIGURATION.tokenRefreshSkewSeconds) * 1000 });
        this.tokens.set(connection.id, value);
        return value.value;
      },
      { signal }
    );
  }
  private async departments(token: string, signal: AbortSignal): Promise<readonly Record<string, unknown>[]> {
    const url = new URL(WECOM_PROVIDER_CONFIGURATION.corp.departments);
    url.searchParams.set('access_token', token);
    const body = await this.request(url, signal);
    if (!Array.isArray(body.department)) throw new Error('DIRECTORY_PROVIDER_RESPONSE_INVALID');
    return body.department.map(record);
  }
  private async users(token: string, offset: number, signal: AbortSignal): Promise<readonly Record<string, unknown>[]> {
    const url = new URL(WECOM_PROVIDER_CONFIGURATION.corp.users);
    url.searchParams.set('access_token', token);
    url.searchParams.set('department_id', '1');
    url.searchParams.set('fetch_child', '1');
    url.searchParams.set('offset', String(offset));
    url.searchParams.set('limit', String(WECOM_PROVIDER_CONFIGURATION.pageSize));
    const body = await this.request(url, signal);
    const source = Array.isArray(body.userlist) ? body.userlist : Array.isArray(body.user) ? body.user : null;
    if (source === null) throw new Error('DIRECTORY_PROVIDER_RESPONSE_INVALID');
    return source.map(record).slice(0, WECOM_PROVIDER_CONFIGURATION.pageSize);
  }
  private async request(url: URL, signal: AbortSignal): Promise<Record<string, unknown>> {
    const response = await this.http.send(url, { headers: { accept: 'application/json' } }, { mode: 'read', signal });
    const body = (await response.json()) as unknown;
    if (!response.ok || body === null || typeof body !== 'object' || Array.isArray(body) || (body as Record<string, unknown>).errcode !== 0) throw new Error('DIRECTORY_PROVIDER_UNAVAILABLE');
    return body as Record<string, unknown>;
  }
}
function decodeCursor(cursor: string | null): number {
  if (cursor === null) return 0;
  let value: unknown;
  try {
    value = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
  } catch {
    throw new Error('DIRECTORY_CURSOR_INVALID');
  }
  if (value === null || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).join() !== 'offset' || !Number.isSafeInteger((value as { offset: unknown }).offset) || (value as { offset: number }).offset < 0)
    throw new Error('DIRECTORY_CURSOR_INVALID');
  return (value as { offset: number }).offset;
}
function record(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('DIRECTORY_PROVIDER_RESPONSE_INVALID');
  return value as Record<string, unknown>;
}
