import { channelFailure, type ChannelFailure } from './Failure';

export type WebhookReceiptState = 'received' | 'processing' | 'verified' | 'failed';

export interface WebhookReceiptSnapshot {
  readonly id: string;
  readonly connection: string;
  readonly provider: string;
  readonly scope: string;
  readonly externalId: string;
  readonly state: WebhookReceiptState;
  readonly attempts: number;
  readonly ciphertext: string;
  readonly keyVersion: string;
  readonly rawHash: string;
  readonly signatureHash: string;
  readonly receivedAt: string;
  readonly trace: string;
  readonly failure: ChannelFailure | null;
  readonly version: number;
}

export class WebhookReceipt {
  readonly value: Readonly<WebhookReceiptSnapshot>;

  constructor(value: WebhookReceiptSnapshot) {
    if (
      [value.id, value.connection, value.provider, value.scope, value.externalId, value.ciphertext, value.keyVersion, value.trace].some((item) => !item.trim()) ||
      !Number.isSafeInteger(value.attempts) ||
      value.attempts < 0 ||
      !/^[a-f0-9]{64}$/.test(value.rawHash) ||
      !/^[a-f0-9]{64}$/.test(value.signatureHash) ||
      Number.isNaN(Date.parse(value.receivedAt)) ||
      !Number.isSafeInteger(value.version) ||
      value.version < 0
    ) {
      throw new Error('CHANNEL_WEBHOOK_RECEIPT_INVALID');
    }
    const failure = channelFailure(value.failure);
    if ((value.state === 'failed') !== (failure !== null)) throw new Error('CHANNEL_WEBHOOK_RECEIPT_FAILURE_INVALID');
    this.value = Object.freeze({ ...value, failure });
    Object.freeze(this);
  }
}
