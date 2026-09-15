import { DeliveryError } from './errors.mjs';

const TRANSIENT_CODES = new Set(['ECONNRESET', 'ECONNREFUSED', 'EAI_AGAIN', 'ENETDOWN', 'ENETUNREACH', 'EPIPE', 'ETIMEDOUT', 'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_SOCKET']);
const NON_RETRYABLE_CODES = /(?:CONFLICT|MISMATCH|INVALID|FORBIDDEN|DENIED|UNAUTHORIZED|VALIDATION|BUILD_FAILED|TEST_FAILED|TYPECHECK_FAILED)/;

export function isTransientNetworkFailure(error) {
  const code = error?.code ?? error?.cause?.code;
  if (TRANSIENT_CODES.has(code)) return true;
  const status = Number(error?.status ?? error?.statusCode);
  return status === 408 || status === 429 || (status >= 500 && status <= 504);
}

export function classifyDeliveryFailure(error, stage) {
  const code = String(error?.code ?? 'DELIVERY_UNEXPECTED');
  const retryable = typeof error?.details?.retryable === 'boolean'
    ? error.details.retryable
    : !NON_RETRYABLE_CODES.test(code) && isTransientNetworkFailure(error);
  return Object.freeze({
    code,
    stage,
    retryable,
    nextSafeAction: error?.details?.nextSafeAction ?? (retryable ? 'retry-same-operation-without-duplicating-dispatch' : 'stop-and-review-evidence'),
  });
}

export async function withFiniteRetry(operation, options = {}) {
  const stage = options.stage ?? 'network';
  const maxAttempts = Number(options.maxAttempts ?? 3);
  const sleep = options.sleep ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  const shouldRetry = options.shouldRetry ?? isTransientNetworkFailure;
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const value = await operation(attempt);
      return { value, attempts: attempt, retryCount: attempt - 1 };
    } catch (error) {
      lastError = error;
      if (!shouldRetry(error) || attempt === maxAttempts) {
        const failure = classifyDeliveryFailure(error, stage);
        if (!failure.retryable) throw error;
        throw new DeliveryError(`${stage.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}_RETRY_EXHAUSTED`, `${stage} exhausted its finite retry budget`, {
          stage, retryable: true, attempts: attempt, nextSafeAction: failure.nextSafeAction, causeCode: error?.code ?? error?.cause?.code,
        });
      }
      await sleep((options.delaysMs ?? [250, 1000, 3000])[Math.min(attempt - 1, (options.delaysMs ?? [250, 1000, 3000]).length - 1)]);
    }
  }
  throw lastError;
}
