import { randomToken } from './Device';

export interface Authorization {
  readonly request: Readonly<{ state: string; nonce: string; challenge: string }>;
  readonly secret: Readonly<{ state: string; nonce: string; verifier: string }>;
}

export interface AuthorizationPort {
  create(): Promise<Authorization>;
}

export class AuthorizationFactory implements AuthorizationPort {
  private pending: Promise<Authorization | undefined> | undefined;

  prewarm(): void {
    this.pending ??= createAuthorization().then((value) => value, () => undefined);
  }

  create(): Promise<Authorization> {
    const warmed = this.pending;
    this.pending = undefined;
    const authorization = warmed?.then((value) => value ?? createAuthorization()) ?? createAuthorization();
    return authorization.finally(() => this.prewarm());
  }
}

export async function createAuthorization(): Promise<Authorization> {
  const state = randomToken(32);
  const nonce = randomToken(32);
  const verifier = randomToken(64);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return Object.freeze({
    request: Object.freeze({ state, nonce, challenge: base64url(new Uint8Array(digest)) }),
    secret: Object.freeze({ state, nonce, verifier }),
  });
}

function base64url(value: Uint8Array): string {
  let binary = '';
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}
