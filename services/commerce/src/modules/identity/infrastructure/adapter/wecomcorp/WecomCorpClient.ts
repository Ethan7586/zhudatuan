import { DomainError } from '../../../../../foundation/domain/DomainError';
import { WECOM_PROVIDER_CONFIGURATION } from '@shop/config/server';
import { Singleflight } from '../../../../../foundation/performance/Singleflight';
import type { ProviderInstance } from '../../../domain/model/ProviderInstance';
import type { ProviderHttpClient } from '../../security/ProviderHttpClient';

export class WecomCorpClient {
  private readonly flights = new Singleflight();
  private readonly tokens = new Map<string, Readonly<{ value: string; expires: number }>>();
  constructor(private readonly client: ProviderHttpClient) {}
  async identity(instance: ProviderInstance, code: string, signal?: AbortSignal, deadline?: number): Promise<Record<string, unknown>> {
    const token = await this.token(instance, signal, deadline);
    const url = new URL(WECOM_PROVIDER_CONFIGURATION.corp.user);
    url.searchParams.set('access_token', token);
    url.searchParams.set('code', code);
    const response = await this.client.send(url, { headers: { accept: 'application/json' } }, { mode: 'read', signal, deadline });
    return this.client.json(response, 'IDENTITY_PROVIDER_UNAVAILABLE');
  }
  private async token(instance: ProviderInstance, signal?: AbortSignal, deadline?: number): Promise<string> {
    const cached = this.tokens.get(instance.id);
    if (cached && cached.expires > Date.now()) return cached.value;
    return this.flights.run(
      instance.id,
      async () => {
        const credentials = await this.client.credentials(instance.secretref);
        const url = new URL(WECOM_PROVIDER_CONFIGURATION.corp.token);
        url.searchParams.set('corpid', credentials.tenant);
        url.searchParams.set('corpsecret', credentials.secret);
        const response = await this.client.send(url, { headers: { accept: 'application/json' } }, { mode: 'read', signal, deadline });
        const body = await this.client.json(response, 'IDENTITY_PROVIDER_UNAVAILABLE');
        if (body.errcode !== 0 || typeof body.access_token !== 'string' || typeof body.expires_in !== 'number') {
          throw new DomainError('IDENTITY_PROVIDER_UNAVAILABLE');
        }
        const expires = Date.now() + Math.max(60, body.expires_in - WECOM_PROVIDER_CONFIGURATION.tokenRefreshSkewSeconds) * 1_000;
        this.tokens.set(instance.id, Object.freeze({ value: body.access_token, expires }));
        return body.access_token;
      },
      { signal, deadline }
    );
  }
}
