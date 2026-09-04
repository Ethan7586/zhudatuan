import type { EventPayload } from '@shop/contract';

export type ChannelWebhookState = 'processing' | 'succeeded' | 'failed' | 'unknown';
export type ChannelWebhookEvent = EventPayload<'channel.webhook.applied'>;
