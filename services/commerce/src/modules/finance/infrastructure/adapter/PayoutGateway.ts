import { HttpClient } from '../../../../foundation/http/HttpClient';
import { invalidExternalResponse, readExternalJson } from '../../../../foundation/http/ExternalResponse';
import type { PayoutGateway as PayoutPort, PayoutInput, PayoutResult } from '../../application/port/PayoutGateway';

export interface PayoutConfiguration {
  readonly endpoint: string;
  readonly bearer: string;
  readonly provider: string;
}

export class PayoutGateway implements PayoutPort {
  private readonly http: HttpClient;

  constructor(
    private readonly configuration: PayoutConfiguration,
    fetcher: typeof fetch = fetch
  ) {
    if (!configuration.endpoint.startsWith('https://') || configuration.bearer.length < 16 || !/^[a-z][a-z0-9]{1,31}$/.test(configuration.provider)) throw new Error('PAYOUT_CONFIGURATION_INVALID');
    this.http = new HttpClient(fetcher);
  }

  async submit(input: PayoutInput): Promise<PayoutResult> {
    if (!/^[a-f0-9]{64}$/.test(input.inputHash)) throw new Error('PAYOUT_INPUT_HASH_INVALID');
    const response = await this.http.send(
      `${this.configuration.endpoint.replace(/\/$/, '')}/v1/payouts`,
      {
        method: 'POST',
        redirect: 'error',
        headers: {
          accept: 'application/json',
          authorization: `Bearer ${this.configuration.bearer}`,
          'content-type': 'application/json',
          'idempotency-key': input.withdrawal,
          'x-input-hash': input.inputHash,
        },
        body: JSON.stringify(input),
      },
      { mode: 'businesskeywrite' }
    );
    const value = (await readExternalJson(response, 'PAYOUT_PROVIDER_UNAVAILABLE', 'PAYOUT_PROVIDER_RESPONSE_INVALID')) as Readonly<{ reference?: unknown; state?: unknown; reason?: unknown }>;
    if (typeof value.reference !== 'string' || !value.reference || !['processing', 'paid', 'failed'].includes(String(value.state)) || (value.reason !== undefined && typeof value.reason !== 'string'))
      throw invalidExternalResponse('PAYOUT_PROVIDER_RESPONSE_INVALID');
    return Object.freeze({ provider: this.configuration.provider, reference: value.reference, state: value.state as PayoutResult['state'], ...(value.reason === undefined ? {} : { reason: value.reason }) });
  }
}
