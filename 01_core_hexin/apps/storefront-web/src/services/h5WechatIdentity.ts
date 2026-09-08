import { anonymousIdempotentContext, canonicalCall, canonicalClient, sessionContext } from './canonicalApiClient';
import { beginBrowserAuthorization } from '@shop/sdk/browser-authorization';
import { createSecureId } from '@shop/sdk/context';
import { nonNegativeInteger, record, text } from './canonicalShape';
import { ProductionApiError } from './productionApi.error';
import { resolveStorefrontApplication, resolveStorefrontAuthTarget } from '../config/storefrontIdentity';

export interface H5WechatAuthorization {
  readonly request: Readonly<{ state: string; nonce: string; challenge: string }>;
  readonly secret: Readonly<{ nonce: string; verifier: string }>;
}

export type H5WechatExchange =
  | Readonly<{ kind: 'binding'; bindingToken: string; confirmationRequired: boolean }>
  | Readonly<{ kind: 'authenticated'; callback: Readonly<{ ticket: string; state: string }> }>;

export type H5WechatSessionMode = 'anonymous' | 'authenticated';

export interface H5WechatJsSdkConfiguration {
  readonly appId: string;
  readonly timestamp: number;
  readonly nonceStr: string;
  readonly signature: string;
  readonly jsApiList: readonly ['openAddress'];
}

const WECHAT_NETWORK_RETRY_DELAYS = [600, 1_400] as const;

export async function beginH5WechatAuthorization(): Promise<H5WechatAuthorization> {
  return beginBrowserAuthorization();
}

export async function requestH5WechatAuthorization(authorization: H5WechatAuthorization, mode: H5WechatSessionMode = 'anonymous'): Promise<string> {
  const context = wechatSessionContext(mode);
  const value = record(await retryH5WechatNetworkRequest(() => canonicalCall(() => canonicalClient().identity.wechatSession({
    body: { scene: 'jsapi', action: 'authorize', mode, authorization: authorization.request },
  }, context))), 'identity.wechat.authorize');
  return text(value.authorizationUrl, 'identity.wechat.authorizationUrl');
}

export async function exchangeH5WechatCode(code: string, authorization: H5WechatAuthorization, mode: H5WechatSessionMode = 'anonymous'): Promise<H5WechatExchange> {
  const context = wechatSessionContext(mode);
  const application = resolveStorefrontApplication();
  const value = record(await retryH5WechatNetworkRequest(() => canonicalCall(() => canonicalClient().identity.wechatSession({
    body: { scene: 'jsapi', action: 'exchange', mode, code, application, target: resolveStorefrontAuthTarget(application), authorization: authorization.request },
  }, context))), 'identity.wechat.exchange');
  if (typeof value.bindingToken === 'string' && value.bindingToken.length > 0) {
    return Object.freeze({ kind: 'binding', bindingToken: value.bindingToken,
      confirmationRequired: value.state === 'account_confirmation_required' });
  }
  const callback = record(value.callback, 'identity.wechat.exchange.callback');
  return Object.freeze({ kind: 'authenticated', callback: Object.freeze({
    ticket: text(callback.ticket, 'identity.wechat.exchange.callback.ticket'),
    state: text(callback.state, 'identity.wechat.exchange.callback.state'),
  }) });
}

export async function completeH5WechatSession(callback: Readonly<{ ticket: string; state: string }>, authorization: H5WechatAuthorization): Promise<void> {
  const context = anonymousIdempotentContext();
  await retryH5WechatNetworkRequest(() => canonicalCall(() => canonicalClient().identity.ticketsExchange({ body: {
    ticket: callback.ticket,
    state: callback.state,
    nonce: authorization.secret.nonce,
    verifier: authorization.secret.verifier,
  } }, context)));
}

export async function bindH5WechatIdentity(bindingToken: string): Promise<void> {
  const context = sessionContext({
    write: true,
    idempotencyKey: createSecureId(),
  });
  await retryH5WechatNetworkRequest(() => canonicalCall(() => canonicalClient().identity.wechatBind({ body: { bindingToken } }, context)));
}

export async function requestH5WechatJsSdkConfiguration(url: string): Promise<H5WechatJsSdkConfiguration> {
  const value = record(await retryH5WechatNetworkRequest(() => canonicalCall(() => canonicalClient().identity.wechatSession({
    body: { scene: 'jsapi', action: 'jssdk_config', url },
  }, wechatSessionContext('authenticated')))), 'identity.wechat.jssdk');
  if (!Array.isArray(value.jsApiList) || value.jsApiList.length !== 1 || value.jsApiList[0] !== 'openAddress') {
    throw new Error('微信地址能力配置无效');
  }
  return Object.freeze({
    appId: text(value.appId, 'identity.wechat.jssdk.appId'),
    timestamp: nonNegativeInteger(value.timestamp, 'identity.wechat.jssdk.timestamp'),
    nonceStr: text(value.nonceStr, 'identity.wechat.jssdk.nonceStr'),
    signature: text(value.signature, 'identity.wechat.jssdk.signature'),
    jsApiList: Object.freeze(['openAddress'] as const),
  });
}

export async function retryH5WechatNetworkRequest<T>(
  request: () => Promise<T>,
  wait: (milliseconds: number) => Promise<void> = waitFor,
): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await request();
    } catch (cause) {
      const delay = WECHAT_NETWORK_RETRY_DELAYS[attempt];
      if (!(cause instanceof ProductionApiError) || cause.code !== 'NETWORK_OR_CLIENT_ERROR' || delay === undefined) throw cause;
      await wait(delay);
    }
  }
}

function wechatSessionContext(mode: H5WechatSessionMode) {
  return mode === 'authenticated'
    ? sessionContext({ write: true, idempotencyKey: createSecureId(), includeScope: false })
    : anonymousIdempotentContext();
}

function waitFor(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}
