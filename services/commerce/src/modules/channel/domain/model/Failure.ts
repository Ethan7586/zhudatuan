export const ChannelFailureClasses = Object.freeze(['validation', 'authentication', 'authorization', 'conflict', 'ratelimit', 'timeout', 'unavailable', 'provider', 'unknown'] as const);

export type ChannelFailureClass = (typeof ChannelFailureClasses)[number];

export interface ChannelFailure {
  readonly classification: ChannelFailureClass;
  readonly code: string;
  readonly retryable: boolean;
}

export function channelFailure(value: ChannelFailure | null): ChannelFailure | null {
  if (value === null) return null;
  if (!ChannelFailureClasses.includes(value.classification) || !/^[A-Z][A-Z0-9_]{2,127}$/.test(value.code)) {
    throw new Error('CHANNEL_FAILURE_INVALID');
  }
  return Object.freeze({ classification: value.classification, code: value.code, retryable: value.retryable });
}

export function terminalChannelFailure(cause: unknown, fallback: string): ChannelFailure {
  const code = safeCode(cause, fallback);
  const classification: ChannelFailureClass =
    code.includes('SIGNATURE') || code.includes('CREDENTIAL')
      ? 'authentication'
      : code.includes('AUTHORIZATION') || code.includes('SCOPE')
        ? 'authorization'
        : code.includes('RATE') || code.includes('BULKHEAD')
          ? 'ratelimit'
          : code.includes('TIMEOUT') || code.includes('DEADLINE')
            ? 'timeout'
            : code.includes('UNAVAILABLE') || code.includes('CIRCUIT') || code.includes('MISSING')
              ? 'unavailable'
              : code.includes('CONFLICT') || code.includes('VERSION')
                ? 'conflict'
                : code.includes('INVALID') || code.includes('REQUIRED')
                  ? 'validation'
                  : code.startsWith('PROVIDER_')
                    ? 'provider'
                    : 'unknown';
  return Object.freeze({ classification, code, retryable: false });
}

function safeCode(cause: unknown, fallback: string): string {
  const message = cause instanceof Error ? cause.message : typeof cause === 'string' ? cause : fallback;
  const code = message.split(':', 1)[0]?.trim() ?? '';
  return /^[A-Z][A-Z0-9_]{2,127}$/.test(code) ? code : fallback;
}
