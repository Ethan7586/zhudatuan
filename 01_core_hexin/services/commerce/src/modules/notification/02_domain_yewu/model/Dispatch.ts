import type {
  DeliveryChannelId,
  DeliveryVariables,
} from './Template';

export type DispatchState = 'queued' | 'sending' | 'sent' | 'failed' | 'cancelled';

export class Dispatch {
  constructor(readonly id: string, readonly scope: string, readonly member: string | null, readonly template: string,
    readonly channel: DeliveryChannelId, readonly recipient: string, readonly variables: DeliveryVariables,
    readonly subject: string | null, readonly body: string, readonly state: DispatchState) {
    if (!id || !scope || !template || !recipient || !body || !['queued', 'sending', 'sent', 'failed', 'cancelled'].includes(state)) {
      throw new Error('NOTIFICATION_DISPATCH_INVALID');
    }
    Object.freeze(this);
  }

  static retryDelay(attempt: number): number {
    if (!Number.isSafeInteger(attempt) || attempt < 1) throw new Error('NOTIFICATION_ATTEMPT_INVALID');
    return Math.min(60 * 60, 2 ** Math.min(attempt, 10) * 15);
  }
}
