import { createRequestContext, type RequestContext } from '@shop/sdk';
import type { OperationOutputFor } from '@shop/contract';
import type { MiniappRuntimeEnvironment } from '../config/Environment';
import { randomToken } from '../platform/Random';

const DEVICE_KEY = 'zhudatuan:miniapp:device:v1';

export async function miniappContext(
  environment: MiniappRuntimeEnvironment,
  session?: OperationOutputFor<'identity.session.read'>,
  options: Readonly<{
    signal?: AbortSignal | undefined;
    csrf?: string | undefined;
    command?: boolean | undefined;
    idempotencyKey?: string | undefined;
    expectedVersion?: number | undefined;
    includeScope?: boolean | undefined;
  }> = {}
): Promise<RequestContext> {
  if (session !== undefined && session.target !== 'miniapp') throw new Error('MINIAPP_SESSION_TARGET_INVALID');
  return createRequestContext(environment.clientVersion, {
    target: 'miniapp',
    storefrontHandle: environment.storefrontHandle,
    traceId: await randomToken(16),
    deviceId: await deviceId(),
    ...(session === undefined || options.includeScope === false ? {} : { scope: session.scope, accessVersion: session.accessVersion }),
    ...(options.signal === undefined ? {} : { signal: options.signal }),
    ...(options.csrf === undefined ? {} : { csrfToken: options.csrf }),
    ...(options.expectedVersion === undefined ? {} : { expectedVersion: options.expectedVersion }),
    ...(options.command ? { idempotencyKey: options.idempotencyKey ?? (await randomToken(32)) } : {}),
  });
}

async function deviceId(): Promise<string> {
  const existing = wx.getStorageSync(DEVICE_KEY);
  if (typeof existing === 'string' && /^[A-Za-z0-9_-]{32,128}$/.test(existing)) return existing;
  const created = await randomToken(32);
  wx.setStorageSync(DEVICE_KEY, created);
  return created;
}
