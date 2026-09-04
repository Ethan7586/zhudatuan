import type { DeliveryChannel, DeliveryRequest } from '@shop/contract';
import { Executor } from '@shop/kernel';
import { email, type EmailConfiguration } from './Config';
import { EMAIL_POLICY } from './Manifest';

export class EmailClient implements DeliveryChannel {
  readonly id = 'email' as const;
  readonly provider: string;
  readonly priority: number;
  private readonly executor = new Executor(EMAIL_POLICY);

  constructor(
    private readonly configuration: EmailConfiguration,
    private readonly bearer: string,
    private readonly fetcher: typeof fetch = fetch
  ) {
    if (bearer.length < 16) throw new Error('EMAIL_CREDENTIAL_INVALID');
    this.provider = configuration.provider;
    this.priority = configuration.priority;
  }

  async send(request: DeliveryRequest) {
    if (!email(request.recipient) || !request.subject?.trim() || !request.idempotency.trim()) throw new Error('EMAIL_DELIVERY_REQUEST_INVALID');
    return this.executor.run((deadline) => this.deliver(request, deadline.signal), {
      mode: 'businesskeywrite', signal: request.signal, deadline: request.deadline, retryable,
    });
  }

  circuitState() {
    return this.executor.circuitState();
  }

  private async deliver(request: DeliveryRequest, signal: AbortSignal) {
    let response: Response;
    try {
      response = await this.fetcher(`${this.configuration.endpoint}/v1/messages`, {
        method: 'POST', redirect: 'error', signal,
        headers: { accept: 'application/json', authorization: `Bearer ${this.bearer}`, 'content-type': 'application/json', 'idempotency-key': request.idempotency,
          ...(request.requestId ? { 'x-request-id': trace(request.requestId) } : {}), ...(request.traceId ? { 'x-trace-id': trace(request.traceId) } : {}) },
        body: JSON.stringify({ from: this.configuration.sender, to: request.recipient, subject: request.subject, text: request.body,
          template: request.providerTemplate, variables: request.variables }),
      });
    } catch (cause) {
      throw new Error('EMAIL_PROVIDER_OUTCOME_UNKNOWN', { cause });
    }
    if (!response.ok) {
      if (response.status >= 400 && response.status < 500 && response.status !== 408 && response.status !== 429) throw new Error('EMAIL_PROVIDER_REJECTED');
      throw new Error('EMAIL_PROVIDER_UNAVAILABLE');
    }
    const value = (await response.json()) as Readonly<Record<string, unknown>>;
    if (typeof value.id !== 'string' || !value.id) throw new Error('EMAIL_PROVIDER_RESPONSE_INVALID');
    return Object.freeze({ provider: this.provider, externalId: value.id });
  }
}

function trace(value: string): string {
  if (!/^[A-Za-z0-9:._-]{1,128}$/.test(value)) throw new Error('EMAIL_TRACE_INVALID');
  return value;
}

function retryable(cause: unknown): boolean {
  return cause instanceof Error && (cause.message === 'EMAIL_PROVIDER_OUTCOME_UNKNOWN' || cause.message === 'EMAIL_PROVIDER_UNAVAILABLE');
}
