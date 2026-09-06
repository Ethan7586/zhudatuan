import { anonymousIdempotentContext, canonicalCall, canonicalClient, sessionContext } from './canonicalApiClient';
import { record, text } from './canonicalShape';

export interface H5WechatAuthorization {
  readonly request: Readonly<{ state: string; nonce: string; challenge: string }>;
  readonly secret: Readonly<{ nonce: string; verifier: string }>;
}

export type H5WechatExchange =
  | Readonly<{ kind: 'binding'; bindingToken: string }>
  | Readonly<{ kind: 'authenticated'; callback: Readonly<{ ticket: string; state: string }> }>;

export type H5WechatSessionMode = 'anonymous' | 'authenticated';

export async function beginH5WechatAuthorization(): Promise<H5WechatAuthorization> {
  const state = randomToken(32);
  const nonce = randomToken(32);
  const verifier = randomToken(64);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return Object.freeze({
    request: Object.freeze({ state, nonce, challenge: base64url(new Uint8Array(digest)) }),
    secret: Object.freeze({ nonce, verifier }),
  });
}

export async function requestH5WechatAuthorization(authorization: H5WechatAuthorization, mode: H5WechatSessionMode = 'anonymous'): Promise<string> {
  const value = record(await canonicalCall(() => canonicalClient().identity.wechatSession({
    body: { scene: 'jsapi', action: 'authorize', authorization: authorization.request },
  }, wechatSessionContext(mode))), 'identity.wechat.authorize');
  return text(value.authorizationUrl, 'identity.wechat.authorizationUrl');
}

export async function exchangeH5WechatCode(code: string, authorization: H5WechatAuthorization, mode: H5WechatSessionMode = 'anonymous'): Promise<H5WechatExchange> {
  const value = record(await canonicalCall(() => canonicalClient().identity.wechatSession({
    body: { scene: 'jsapi', action: 'exchange', code, authorization: authorization.request },
  }, wechatSessionContext(mode))), 'identity.wechat.exchange');
  if (typeof value.bindingToken === 'string' && value.bindingToken.length > 0) {
    return Object.freeze({ kind: 'binding', bindingToken: value.bindingToken });
  }
  const callback = record(value.callback, 'identity.wechat.exchange.callback');
  return Object.freeze({ kind: 'authenticated', callback: Object.freeze({
    ticket: text(callback.ticket, 'identity.wechat.exchange.callback.ticket'),
    state: text(callback.state, 'identity.wechat.exchange.callback.state'),
  }) });
}

export async function completeH5WechatSession(callback: Readonly<{ ticket: string; state: string }>, authorization: H5WechatAuthorization): Promise<void> {
  await canonicalCall(() => canonicalClient().identity.ticketsExchange({ body: {
    ticket: callback.ticket,
    state: callback.state,
    nonce: authorization.secret.nonce,
    verifier: authorization.secret.verifier,
  } }, anonymousIdempotentContext()));
}

export async function bindH5WechatIdentity(bindingToken: string): Promise<void> {
  await canonicalCall(() => canonicalClient().identity.wechatBind({ body: { bindingToken } }, sessionContext({
    write: true,
    idempotencyKey: crypto.randomUUID(),
  })));
}

function wechatSessionContext(mode: H5WechatSessionMode) {
  return mode === 'authenticated'
    ? sessionContext({ write: true, idempotencyKey: crypto.randomUUID(), includeScope: false })
    : anonymousIdempotentContext();
}

function randomToken(bytes: number): string {
  const value = new Uint8Array(bytes);
  crypto.getRandomValues(value);
  return base64url(value);
}

function base64url(value: Uint8Array): string {
  let binary = '';
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}
