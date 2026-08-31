import type { SecretStore } from '../../../../foundation/infrastructure/SecretStore';
import { HttpClient } from '../../../../foundation/http/HttpClient';
import { providerCredential, type ProviderCredential } from '../../../../foundation/infrastructure/ProviderSecret';

export type { ProviderCredential } from '../../../../foundation/infrastructure/ProviderSecret';
export class ProviderHttpClient {
  readonly http: HttpClient;
  constructor(
    private readonly secrets: SecretStore,
    fetcher: typeof fetch = fetch
  ) {
    this.http = new HttpClient(fetcher);
  }
  async credentials(reference: string): Promise<ProviderCredential> {
    return providerCredential(this.secrets, reference);
  }
}
