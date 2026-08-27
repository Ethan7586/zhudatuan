import { createHash } from 'node:crypto';

export interface WebhookRequest {
  readonly providerId: string;
  readonly externalId: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: string;
  readonly receivedAt: string;
  readonly traceId: string;
}

export interface WebhookVerifier { verify(request: WebhookRequest): Promise<boolean> }
export interface WebhookIngress { persist(request: WebhookRequest & { readonly sha256: string }): Promise<'accepted' | 'replayed'> }

export class Webhook {
  constructor(private readonly verifier: WebhookVerifier, private readonly ingress: WebhookIngress) {}

  async receive(request: WebhookRequest): Promise<'accepted' | 'replayed'> {
    if (!await this.verifier.verify(request)) throw new Error('PROVIDER_WEBHOOK_SIGNATURE_INVALID');
    const sha256 = createHash('sha256').update(request.body).digest('hex');
    return this.ingress.persist({ ...request, sha256 });
  }
}
