import type { DeliveryChannelId, DeliveryVariables } from './Template';

export type DispatchState = 'queued' | 'sending' | 'retrying' | 'sent' | 'dead' | 'cancelled';
export type DeliveryFailureClass = 'retryable' | 'permanent' | 'ambiguous';

export interface DeliveryAttempt {
  readonly sequence: number;
  readonly provider: string;
  readonly state: 'sending' | 'sent' | 'failed' | 'ambiguous';
  readonly errorClass: DeliveryFailureClass | null;
  readonly errorCode: string | null;
  readonly externalId: string | null;
  readonly attemptedAt: string;
}

export interface DeliveryFailure {
  readonly kind: DeliveryFailureClass;
  readonly code: string;
  readonly message: string;
}

export class Dispatch {
  constructor(
    readonly id: string,
    readonly scope: string,
    readonly member: string | null,
    readonly template: string,
    readonly channel: DeliveryChannelId,
    readonly recipient: string,
    readonly variables: DeliveryVariables,
    readonly subject: string | null,
    readonly body: string,
    readonly state: DispatchState,
    readonly idempotencyKey: string = id,
    readonly attempts: readonly DeliveryAttempt[] = []
  ) {
    if (!id || !scope || !template || !recipient || !body || !idempotencyKey || idempotencyKey.length > 500 || !['queued', 'sending', 'retrying', 'sent', 'dead', 'cancelled'].includes(state)) {
      throw new Error('NOTIFICATION_DISPATCH_INVALID');
    }
    assertAttempts(attempts);
    Object.freeze(this);
  }

  static retryDelay(attempt: number): number {
    if (!Number.isSafeInteger(attempt) || attempt < 1) throw new Error('NOTIFICATION_ATTEMPT_INVALID');
    return Math.min(60 * 60, 2 ** Math.min(attempt, 10) * 15);
  }
}

export function classifyDeliveryFailure(value: unknown): DeliveryFailure {
  const raw = value instanceof Error ? value.message : 'NOTIFICATION_DELIVERY_FAILED';
  const code = /^[A-Z][A-Z0-9_.:-]{2,199}$/.test(raw) ? raw : 'NOTIFICATION_DELIVERY_FAILED';
  const permanent = /(?:REQUEST_INVALID|RECIPIENT_INVALID|TEMPLATE_INVALID|VARIABLE_TOO_LONG|REJECTED|UNSUBSCRIBED|NOT_FOUND)$/.test(code);
  if (permanent) return Object.freeze({ kind: 'permanent', code, message: '通知内容或收件信息不符合要求，请检查后重试。' });
  const retryable = /(?:UNAVAILABLE|TIMEOUT|THROTTL|RATE_LIMIT|NETWORK|CONNECTION|CIRCUIT|5\d\d)/i.test(code);
  return Object.freeze({ kind: retryable ? 'retryable' : 'ambiguous', code,
    message: retryable ? '通知服务暂时不可用，系统会自动重试。' : '通知服务结果暂时无法确认，系统将继续核对。' });
}

function assertAttempts(attempts: readonly DeliveryAttempt[]): void {
  attempts.forEach((attempt, index) => {
    if (
      attempt.sequence !== index + 1 ||
      !attempt.provider ||
      !['sending', 'sent', 'failed', 'ambiguous'].includes(attempt.state) ||
      Number.isNaN(Date.parse(attempt.attemptedAt)) ||
      (attempt.state === 'sent') !== (attempt.externalId !== null) ||
      (attempt.state === 'failed' || attempt.state === 'ambiguous') !== (attempt.errorCode !== null)
    ) throw new Error('NOTIFICATION_ATTEMPT_INVALID');
  });
  Object.freeze(attempts);
}
