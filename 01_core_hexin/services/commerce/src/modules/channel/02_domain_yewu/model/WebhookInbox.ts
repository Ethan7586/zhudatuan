export type WebhookState = 'received' | 'processing' | 'applied' | 'ignored' | 'failed';

export class WebhookInbox {
  constructor(readonly id: string, readonly connection: string, readonly externalId: string, readonly eventType: string,
    readonly state: WebhookState, readonly attempts: number, readonly rawHash: string, readonly signatureHash: string) {
    if (!id || !connection || !externalId || !eventType || !Number.isSafeInteger(attempts) || attempts < 0
      || !/^[a-f0-9]{64}$/.test(rawHash) || !/^[a-f0-9]{64}$/.test(signatureHash)) throw new Error('CHANNEL_WEBHOOK_INBOX_INVALID');
  }
}
