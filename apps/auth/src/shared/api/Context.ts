import { createIdempotencyKey, createRequestContext } from '@shop/sdk/context';
import type { AuthTarget } from '@shop/config/client';
import type { AuthEnvironment } from '../../config/Environment';
import { deviceId } from '../security/Device';

export function commandContext(environment: AuthEnvironment, target: AuthTarget, csrf: string, signal?: AbortSignal) {
  return createRequestContext(environment.clientVersion, {
    target,
    deviceId: deviceId(),
    csrfToken: csrf,
    idempotencyKey: createIdempotencyKey(),
    ...(signal ? { signal } : {}),
  });
}

export function queryContext(environment: AuthEnvironment, target: AuthTarget, signal?: AbortSignal) {
  return createRequestContext(environment.clientVersion, { target, deviceId: deviceId(), ...(signal ? { signal } : {}) });
}
