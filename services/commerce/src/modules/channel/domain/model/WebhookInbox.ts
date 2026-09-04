import { channelFailure, type ChannelFailure } from './Failure';

export type WebhookState = 'processing' | 'applied' | 'failed';

export interface WebhookInboxSnapshot {
  readonly id: string;
  readonly receipt: string;
  readonly connection: string;
  readonly externalId: string;
  readonly eventType: string;
  readonly state: WebhookState;
  readonly attempts: number;
  readonly rawHash: string;
  readonly signatureHash: string;
  readonly watermark: string;
  readonly failure: ChannelFailure | null;
  readonly version: number;
}

export class WebhookInbox {
  readonly id: string;
  readonly receipt: string;
  readonly connection: string;
  readonly externalId: string;
  readonly eventType: string;
  readonly state: WebhookState;
  readonly attempts: number;
  readonly rawHash: string;
  readonly signatureHash: string;
  readonly watermark: string;
  readonly failure: ChannelFailure | null;
  readonly version: number;

  constructor(value: WebhookInboxSnapshot) {
    if (!value.id.trim() || !value.receipt.trim() || !value.connection.trim() || !value.externalId.trim() || !value.eventType.trim() ||
      !Number.isSafeInteger(value.attempts) || value.attempts < 0 || !/^[a-f0-9]{64}$/.test(value.rawHash) ||
      !/^[a-f0-9]{64}$/.test(value.signatureHash) || Number.isNaN(Date.parse(value.watermark)) ||
      !Number.isSafeInteger(value.version) || value.version < 0) throw new Error('CHANNEL_WEBHOOK_INBOX_INVALID');
    const failure = channelFailure(value.failure);
    if ((value.state === 'failed') !== (failure !== null)) throw new Error('CHANNEL_WEBHOOK_FAILURE_INVALID');
    this.id = value.id;
    this.receipt = value.receipt;
    this.connection = value.connection;
    this.externalId = value.externalId;
    this.eventType = value.eventType;
    this.state = value.state;
    this.attempts = value.attempts;
    this.rawHash = value.rawHash;
    this.signatureHash = value.signatureHash;
    this.watermark = value.watermark;
    this.failure = failure;
    this.version = value.version;
    Object.freeze(this);
  }
}
