import { createIdempotencyKey, createRequestContext } from '@shop/sdk/context';
import { ApiError } from '@shop/sdk/error';
import { createFetchIdentity } from '@shop/sdk/identity';
import type { AuthTarget } from '@shop/config/client';
import type { OperationOutputFor } from '@shop/contract';
import { appConfig } from '../../config/AppConfig';
import type { AuthReturnRequest } from '../../entity/authentication/AuthClient';
import { deviceId, randomToken } from '../security/Device';

interface Authorization {
  readonly request: Readonly<{ state: string; nonce: string; challenge: string }>;
  readonly secret: Readonly<{ state: string; nonce: string; verifier: string }>;
}

interface BootstrapState {
  readonly target: AuthTarget;
  readonly returnTargetRequest?: string;
  readonly returnPath?: string;
  readonly csrf: string;
  readonly returnTarget: string;
  readonly expiresAt: number;
  readonly providers: readonly Awaited<ReturnType<ReturnType<typeof createFetchIdentity>['providersRead']>>['items'][number][];
}

type AuthenticationBody = Readonly<
  | { method: 'password'; subject: string; password: string; target: AuthTarget; returnTarget?: string }
  | { method: 'otp'; subject: string; challenge: string; code: string; target: AuthTarget; returnTarget?: string }
  | { method: 'invitation'; code: string; target: AuthTarget; returnTarget?: string }
>;

export class IdentityClient {
  private readonly identity = createFetchIdentity(appConfig.apiOrigin);
  private readonly bootstraps = new Map<AuthTarget, BootstrapState>();
  private readonly pending = new Map<string, Promise<BootstrapState>>();

  password(subject: string, password: string, target: AuthTarget, returns?: AuthReturnRequest, signal?: AbortSignal) {
    return this.authenticate({ method: 'password', subject: subject.trim(), password, target }, target, returns, signal);
  }

  otp(subject: string, challenge: string, code: string, target: AuthTarget, returns?: AuthReturnRequest, signal?: AbortSignal) {
    return this.authenticate({ method: 'otp', subject: subject.trim(), challenge, code: code.trim(), target }, target, returns, signal);
  }

  invitation(code: string, target: AuthTarget, returns?: AuthReturnRequest, signal?: AbortSignal) {
    return this.authenticate({ method: 'invitation', code, target }, target, returns, signal);
  }

  async invitationProof(reference: string, code: string, target: AuthTarget, returns?: AuthReturnRequest, signal?: AbortSignal) {
    const [authorization, bootstrap] = await Promise.all([beginAuthorization(), this.bootstrap(target, returns, signal)]);
    const result = await this.request(
      this.identity.sessionsComplete(
        {
          body: {
            proof: reference,
            code: code.trim(),
            returnTarget: bootstrap.returnTarget,
            authorization: authorization.request,
          },
        },
        command(target, bootstrap.csrf, signal)
      )
    );
    return this.finish(result, authorization, target, signal);
  }

  async challenge(destination: string, purpose: 'login' | 'password_reset' | 'enrollment', target: AuthTarget = 'storefront', returns?: AuthReturnRequest, signal?: AbortSignal) {
    const bootstrap = await this.bootstrap(target, returns, signal);
    const result = await this.request(this.identity.challengesCreate({ body: { destination: destination.trim(), purpose } }, command(target, bootstrap.csrf, signal)));
    return Object.freeze({ id: result.id, expiresAt: result.expires_at });
  }

  async enrollment(id: string, signal?: AbortSignal) {
    const result = await this.request(this.identity.enrollmentsRead({ path: { id } }, query('storefront', signal)));
    return Object.freeze({
      id: result.id,
      target: result.target,
      expiresAt: result.expiresAt,
      policy: Object.freeze({
        termsTitle: result.policy.terms_title,
        termsBody: result.policy.terms_body,
        privacyTitle: result.policy.privacy_title,
        privacyBody: result.policy.privacy_body,
        termsHash: result.policy.terms_hash,
      }),
    });
  }

  async completeEnrollment(input: Readonly<{ id: string; subject: string; challenge: string; code: string; termsHash: string; password: string; displayName: string }>, signal?: AbortSignal) {
    const [authorization, bootstrap] = await Promise.all([beginAuthorization(), this.bootstrap('storefront', undefined, signal)]);
    const result = await this.request(
      this.identity.enrollmentsComplete(
        {
          path: { id: input.id },
          body: {
            subject: input.subject.trim(),
            challenge: input.challenge,
            code: input.code.trim(),
            termsAccepted: true,
            termsHash: input.termsHash,
            password: input.password,
            displayName: input.displayName.trim(),
            authorization: authorization.request,
          },
        },
        command('storefront', bootstrap.csrf, signal)
      )
    );
    if (result.kind === 'enrolled') return result;
    return this.finish(result, authorization, 'storefront', signal);
  }

  async providers(returns: AuthReturnRequest | undefined, target: AuthTarget, signal?: AbortSignal) {
    const result = await this.bootstrap(target, returns, signal);
    return Object.freeze(result.providers.map(({ id, type }) => Object.freeze({ id, type })));
  }

  async provider(provider: string, target: AuthTarget, returns?: AuthReturnRequest, signal?: AbortSignal) {
    const [authorization, bootstrap] = await Promise.all([beginAuthorization(), this.bootstrap(target, returns, signal)]);
    const result = await this.request(this.identity.federationsStart({ body: { providerid: provider, returntarget: bootstrap.returnTarget, authorization: authorization.request } }, command(target, bootstrap.csrf, signal)));
    return Object.freeze({ kind: 'proofRequired' as const, reference: result.location, expiresAt: new Date(Date.now() + 300_000).toISOString(), method: 'sso' as const, target });
  }

  async membershipSelection(target: AuthTarget, signal?: AbortSignal) {
    const result = await this.request(this.identity.federationsSelectionRead({}, query(target, signal)));
    if (result.target !== target) throw new Error('登录目标与身份选择不一致');
    return Object.freeze({ memberships: Object.freeze(result.memberships.map((membership) => Object.freeze(membership))), expiresAt: result.expiresAt, target: result.target });
  }

  async selectMembership(membership: string, target: AuthTarget, signal?: AbortSignal) {
    const bootstrap = await this.bootstrap(target, undefined, signal);
    const result = await this.request(this.identity.federationsComplete({ body: { membershipid: membership } }, command(target, bootstrap.csrf, signal)));
    return Object.freeze({ kind: 'authenticated', redirectUrl: approvedDestination(result.location, target) });
  }

  async resetPassword(challenge: string, code: string, password: string, signal?: AbortSignal): Promise<void> {
    const bootstrap = await this.bootstrap('storefront', undefined, signal);
    await this.request(this.identity.passwordReset({ body: { challenge, code: code.trim(), newPassword: password } }, command('storefront', bootstrap.csrf, signal)));
  }

  private async authenticate(body: AuthenticationBody, target: AuthTarget, returns?: AuthReturnRequest, signal?: AbortSignal) {
    const [authorization, bootstrap] = await Promise.all([beginAuthorization(), this.bootstrap(target, returns, signal)]);
    const result = await this.request(this.identity.sessionsCreate({ body: { ...body, returnTarget: bootstrap.returnTarget, authorization: authorization.request } }, command(target, bootstrap.csrf, signal)));
    return this.finish(result, authorization, target, signal);
  }

  private async finish(result: OperationOutputFor<'identity.sessions.create'>, authorization: Authorization, target: AuthTarget, signal?: AbortSignal) {
    if (result.kind === 'selection') return result;
    if (result.kind === 'enrollment') return Object.freeze({ kind: 'enrollment', id: result.enrollment.id, expiresAt: result.enrollment.expiresAt });
    if (result.kind === 'proofRequired') {
      if (!result.proof.reference) throw new Error('身份服务未返回必要的验证引用');
      return Object.freeze({ kind: 'proofRequired', reference: result.proof.reference, expiresAt: result.proof.expiresAt, method: result.proof.method, target: result.proof.target });
    }
    const exchanged = await this.request(
      this.identity.ticketsExchange(
        {
          body: {
            ticket: result.ticket,
            state: authorization.secret.state,
            nonce: authorization.secret.nonce,
            verifier: authorization.secret.verifier,
            returnTarget: result.returnTarget,
          },
        },
        command(target, (await this.bootstrap(target, undefined, signal)).csrf, signal)
      )
    );
    if (exchanged.returnTarget.target !== target) throw new Error('登录返回目标不匹配');
    return Object.freeze({ kind: 'authenticated', redirectUrl: approvedDestination(exchanged.returnTarget.url, target) });
  }

  private async request<T>(operation: Promise<T>): Promise<T> {
    try {
      return await operation;
    } catch (cause) {
      if (!(cause instanceof ApiError)) throw cause;
      throw new Error(cause.message, { cause });
    }
  }

  private async bootstrap(target: AuthTarget, returns?: AuthReturnRequest, signal?: AbortSignal): Promise<BootstrapState> {
    const returnTarget = returns?.returnTarget;
    const returnPath = returnTarget ? undefined : returns?.returnPath;
    const current = this.bootstraps.get(target);
    if (current && current.expiresAt > Date.now() && (!returnTarget || current.returnTargetRequest === returnTarget) && (!returnPath || current.returnPath === returnPath)) return consumerResult(Promise.resolve(current), signal);
    const key = `${target}:${returnTarget ?? ''}:${returnPath ?? ''}`;
    const existing = this.pending.get(key);
    if (existing !== undefined) return consumerResult(existing, signal);
    const operation = this.request(this.identity.providersRead(returnTarget ? { query: { returntarget: returnTarget } } : returnPath ? { query: { returnpath: returnPath } } : {}, query(target)))
      .then((result) => {
        if (result.target !== target) throw new Error('登录目标与已签名返回目标不一致');
        const state = Object.freeze({
          target,
          ...(returnTarget ? { returnTargetRequest: returnTarget } : {}),
          ...(returnPath ? { returnPath } : {}),
          csrf: result.csrf,
          returnTarget: result.returnTarget,
          expiresAt: Date.now() + 540_000,
          providers: Object.freeze([...result.items]),
        });
        this.bootstraps.set(target, state);
        return state;
      })
      .finally(() => this.pending.delete(key));
    this.pending.set(key, operation);
    return consumerResult(operation, signal);
  }
}

function consumerResult<T>(operation: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return operation;
  if (signal.aborted) return Promise.reject(signal.reason);
  return new Promise<T>((resolve, reject) => {
    const abort = () => {
      signal.removeEventListener('abort', abort);
      reject(signal.reason);
    };
    signal.addEventListener('abort', abort, { once: true });
    void operation.then(
      (value) => {
        signal.removeEventListener('abort', abort);
        resolve(value);
      },
      (cause: unknown) => {
        signal.removeEventListener('abort', abort);
        reject(cause);
      }
    );
  });
}

async function beginAuthorization(): Promise<Authorization> {
  const state = randomToken(32);
  const nonce = randomToken(32);
  const verifier = randomToken(64);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  let binary = '';
  for (const byte of new Uint8Array(digest)) binary += String.fromCharCode(byte);
  const challenge = btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
  return Object.freeze({ request: Object.freeze({ state, nonce, challenge }), secret: Object.freeze({ state, nonce, verifier }) });
}

function command(target: AuthTarget, csrfToken: string, signal?: AbortSignal) {
  return createRequestContext(appConfig.clientVersion, { target, deviceId: deviceId(), csrfToken, idempotencyKey: createIdempotencyKey(), ...(signal ? { signal } : {}) });
}

function query(target: AuthTarget, signal?: AbortSignal) {
  return createRequestContext(appConfig.clientVersion, { target, deviceId: deviceId(), ...(signal ? { signal } : {}) });
}

function approvedDestination(value: string, target: AuthTarget): string {
  const destination = new URL(value);
  const origin = target === 'console' ? appConfig.consoleOrigin : appConfig.storefrontOrigin;
  if (destination.origin !== origin || destination.username || destination.password || destination.hash) {
    throw new Error('登录回跳地址不在允许清单');
  }
  return destination.toString();
}
