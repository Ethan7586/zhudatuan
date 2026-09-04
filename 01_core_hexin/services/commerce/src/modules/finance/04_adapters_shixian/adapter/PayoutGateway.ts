import { HttpClient } from '../../../../foundation/http/HttpClient';
import type { PayoutGateway as PayoutPort, PayoutInput, PayoutResult } from '../../03_application_yingyong/port/PayoutGateway';

export interface PayoutConfiguration { readonly endpoint: string; readonly bearer: string; readonly provider: string }

export class PayoutGateway implements PayoutPort {
  private readonly http: HttpClient;

  constructor(private readonly configuration: PayoutConfiguration, fetcher: typeof fetch = fetch) {
    if (!configuration.endpoint.startsWith('https://') || configuration.bearer.length < 16
      || !/^[a-z][a-z0-9]{1,31}$/.test(configuration.provider)) throw new Error('PAYOUT_CONFIGURATION_INVALID');
    this.http = new HttpClient(fetcher);
  }

  async submit(input: PayoutInput): Promise<PayoutResult> {
    const response = await this.http.send(`${this.configuration.endpoint.replace(/\/$/, '')}/v1/payouts`, {
      method: 'POST', redirect: 'error', headers: {
        accept: 'application/json', authorization: `Bearer ${this.configuration.bearer}`, 'content-type': 'application/json',
        'idempotency-key': input.withdrawal,
      }, body: JSON.stringify(input),
    }, { mode: 'businesskeywrite' });
    if (!response.ok) throw new Error('PAYOUT_PROVIDER_UNAVAILABLE');
    const value = await response.json() as Readonly<{ reference?: unknown; state?: unknown; reason?: unknown }>;
    if (typeof value.reference !== 'string' || !value.reference
      || !['processing', 'paid', 'failed'].includes(String(value.state))
      || (value.reason !== undefined && typeof value.reason !== 'string')) throw new Error('PAYOUT_PROVIDER_RESPONSE_INVALID');
    return Object.freeze({ reference: value.reference, state: value.state as PayoutResult['state'],
      ...(value.reason === undefined ? {} : { reason: value.reason }) });
  }
}
