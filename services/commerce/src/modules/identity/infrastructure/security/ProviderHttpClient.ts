import type { SecretStore } from '../../../../foundation/infrastructure/SecretStore';
import { HttpClient, type HttpCallContext } from '../../../../foundation/http/HttpClient';
import { providerCredential, type ProviderCredential } from '../../../../foundation/infrastructure/ProviderSecret';
import { DomainError } from '../../../../foundation/domain/DomainError';
import type { ApiErrorCode } from '@shop/contract';

export type { ProviderCredential } from '../../../../foundation/infrastructure/ProviderSecret';
export class ProviderHttpClient {
  private readonly http: HttpClient;
  constructor(
    private readonly secrets: SecretStore,
    fetcher: typeof fetch = fetch
  ) {
    this.http = new HttpClient(fetcher);
  }
  async credentials(reference: string): Promise<ProviderCredential> {
    return providerCredential(this.secrets, reference);
  }

  async send(url: string | URL, init: RequestInit, context: HttpCallContext): Promise<Response> {
    try {
      return await this.http.send(url, init, context);
    } catch (cause) {
      if (cause instanceof DomainError) throw cause;
      throw new DomainError('IDENTITY_PROVIDER_UNAVAILABLE');
    }
  }

  async json(response: Response, code: ApiErrorCode): Promise<Record<string, unknown>> {
    if (!response.ok) throw new DomainError(code);
    try {
      const value = await response.json() as unknown;
      if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new DomainError(code);
      return value as Record<string, unknown>;
    } catch (cause) {
      if (cause instanceof DomainError) throw cause;
      throw new DomainError(code);
    }
  }
}
