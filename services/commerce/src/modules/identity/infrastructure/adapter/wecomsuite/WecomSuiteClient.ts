import { DomainError } from '../../../../../foundation/domain/DomainError';
import { WECOM_PROVIDER_CONFIGURATION } from '@shop/config/server';
import { createHmac } from 'node:crypto';
import { Singleflight } from '../../../../../foundation/performance/Singleflight';
import type { ProviderInstance } from '../../../domain/model/ProviderInstance';
import type { ProviderHttpClient } from '../../security/ProviderHttpClient';
export class WecomSuiteClient {
  private readonly flights = new Singleflight();
  private readonly tokens = new Map<string, Readonly<{ value: string; expires: number }>>();
  constructor(
    private readonly client: ProviderHttpClient,
    private readonly cachekey: string
  ) {
    if (cachekey.length < 32) throw new Error('WECOM_SUITE_CACHE_KEY_INVALID');
  }
  async identity(instance: ProviderInstance, code: string, signal?: AbortSignal, deadline?: number): Promise<Record<string, unknown>> {
    const token = await this.token(instance, signal, deadline);
    const url = new URL(WECOM_PROVIDER_CONFIGURATION.suite.loginInfo);
    url.searchParams.set('access_token', token);
    const response = await this.client.http.send(
      url,
      {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ auth_code: code }),
      },
      { mode: 'none', signal, deadline }
    );
    if (!response.ok) throw new DomainError('IDENTITY_PROVIDER_UNAVAILABLE');
    return response.json() as Promise<Record<string, unknown>>;
  }
  private async token(instance: ProviderInstance, signal?: AbortSignal, deadline?: number): Promise<string> {
    const key = createHmac('sha256', this.cachekey).update(instance.id).digest('hex');
    const cached = this.tokens.get(key);
    if (cached && cached.expires > Date.now()) return cached.value;
    return this.flights.run(
      key,
      async () => {
        const credential = await this.client.credentials(instance.secretref);
        if (!credential.suiteid || !credential.token) throw new DomainError('IDENTITY_PROVIDER_CONFIGURATION_INVALID');
        const response = await this.client.http.send(
          WECOM_PROVIDER_CONFIGURATION.suite.suiteToken,
          {
            method: 'POST',
            headers: {
              accept: 'application/json',
              'content-type': 'application/json',
            },
            body: JSON.stringify({ suite_id: credential.suiteid, suite_secret: credential.secret, suite_ticket: credential.token }),
          },
          { mode: 'none', signal, deadline }
        );
        const body = (await response.json()) as Record<string, unknown>;
        if (!response.ok || body.errcode !== 0 || typeof body.suite_access_token !== 'string' || typeof body.expires_in !== 'number') {
          throw new DomainError('IDENTITY_PROVIDER_UNAVAILABLE');
        }
        const expires = Date.now() + Math.max(60, body.expires_in - WECOM_PROVIDER_CONFIGURATION.tokenRefreshSkewSeconds) * 1_000;
        this.tokens.set(key, Object.freeze({ value: body.suite_access_token, expires }));
        return body.suite_access_token;
      },
      { signal, deadline }
    );
  }
}
