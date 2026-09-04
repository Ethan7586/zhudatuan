export const FailureKinds = Object.freeze([
  'authentication',
  'authorization',
  'conflict',
  'ratelimit',
  'timeout',
  'unavailable',
  'transport',
  'provider',
  'response',
  'unknown',
] as const);

export type FailureKind = (typeof FailureKinds)[number];

/** Safe, classified failure crossing an infrastructure boundary. */
export class Failure extends Error {
  constructor(
    readonly code: string,
    readonly kind: FailureKind,
    readonly retryable: boolean,
    readonly status?: number,
    options?: ErrorOptions
  ) {
    if (!/^[A-Z][A-Z0-9_]{2,127}$/.test(code) || !FailureKinds.includes(kind) ||
      (status !== undefined && (!Number.isSafeInteger(status) || status < 100 || status > 599))) {
      throw new Error('FAILURE_INVALID');
    }
    super(code, options);
    this.name = 'Failure';
  }
}

export function mapFailure(
  cause: unknown,
  fallback: Readonly<{ code: string; kind: FailureKind; retryable: boolean; status?: number }>
): Failure {
  if (cause instanceof Failure) return cause;
  return new Failure(fallback.code, fallback.kind, fallback.retryable, fallback.status, { cause });
}

export function statusFailure(code: string, status: number): Failure {
  const kind: FailureKind = status === 401 ? 'authentication'
    : status === 403 ? 'authorization'
      : status === 409 ? 'conflict'
        : status === 429 ? 'ratelimit'
          : status === 408 || status === 504 ? 'timeout'
            : status >= 500 ? 'unavailable'
              : 'response';
  return new Failure(code, kind, [408, 425, 429].includes(status) || status >= 500, status);
}
