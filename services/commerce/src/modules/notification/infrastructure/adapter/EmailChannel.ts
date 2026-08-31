import type { DeliveryChannel } from '../../application/port/DeliveryChannel';
import { HttpClient } from '../../../../foundation/http/HttpClient';

export interface EmailConfiguration {
  readonly endpoint: string;
  readonly bearer: string;
  readonly provider: string;
  readonly sender: string;
}

export class EmailChannel implements DeliveryChannel {
  readonly id = 'email' as const;
  private readonly http: HttpClient;

  constructor(
    private readonly configuration: EmailConfiguration,
    fetcher: typeof fetch = fetch
  ) {
    if (!configuration.endpoint.startsWith('https://') || configuration.bearer.length < 16 || !/^[a-z][a-z0-9]{1,31}$/.test(configuration.provider) || !email(configuration.sender)) {
      throw new Error('EMAIL_CONFIGURATION_INVALID');
    }
    this.http = new HttpClient(fetcher);
  }

  async send(request: Parameters<DeliveryChannel['send']>[0]) {
    if (!email(request.recipient) || !request.subject?.trim()) throw new Error('EMAIL_DELIVERY_REQUEST_INVALID');
    const response = await this.http.send(
      `${this.configuration.endpoint.replace(/\/$/, '')}/v1/messages`,
      {
        method: 'POST',
        redirect: 'error',
        headers: { accept: 'application/json', authorization: `Bearer ${this.configuration.bearer}`, 'content-type': 'application/json', 'idempotency-key': request.idempotency },
        body: JSON.stringify({ from: this.configuration.sender, to: request.recipient, subject: request.subject, text: request.body, template: request.providerTemplate, variables: request.variables }),
      },
      { mode: 'businesskeywrite' }
    );
    if (!response.ok) throw new Error('EMAIL_PROVIDER_UNAVAILABLE');
    const value = (await response.json()) as Readonly<Record<string, unknown>>;
    if (typeof value.id !== 'string' || !value.id) throw new Error('EMAIL_PROVIDER_RESPONSE_INVALID');
    return Object.freeze({ provider: this.configuration.provider, externalId: value.id });
  }
}

function email(value: string): boolean {
  return /^[^\s@]{1,64}@[^\s@]{1,190}$/.test(value);
}
