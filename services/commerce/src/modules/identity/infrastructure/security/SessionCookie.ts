import type { AuthTarget } from '@shop/config/server';
import type { SessionCookiePort } from '../../application/port/SessionCookiePort';

export class SessionCookieAdapter implements SessionCookiePort {
  session(target: AuthTarget, token: string, csrf: string, maxAge: number): Readonly<Record<string, string>> {
    return sessionCookies(target, token, csrf, maxAge);
  }
  read(value: string | undefined, name: string): string | undefined {
    return requestCookie(value, name);
  }
  preauth(token: string, maxAge = 300): string {
    return preauthCookie(token, maxAge);
  }
}

export function sessionCookies(target: AuthTarget, token: string, csrf: string, maxAge: number): Readonly<Record<string, string>> {
  const clearing = maxAge === 0 && token === '' && csrf === '';
  if ((!clearing && (!/^[A-Za-z0-9_-]{32,1024}$/.test(token) || !/^[A-Za-z0-9._~-]{32,2048}$/.test(csrf))) || !Number.isSafeInteger(maxAge) || maxAge < 0 || maxAge > 43_200) throw new Error('SESSION_COOKIE_INVALID');
  const expiry = maxAge === 0 ? '; Expires=Thu, 01 Jan 1970 00:00:00 GMT' : '';
  return Object.freeze({
    'set-cookie': `__Host-${target}-session=${encodeURIComponent(token)}; Path=/; Max-Age=${maxAge}; Secure; HttpOnly; SameSite=Strict${expiry}`,
    'x-set-cookie': `__Host-${target}-csrf=${encodeURIComponent(csrf)}; Path=/; Max-Age=${maxAge}; Secure; SameSite=Strict${expiry}`,
  });
}

export function requestCookie(value: string | undefined, name: string): string | undefined {
  for (const part of value?.split(';') ?? []) {
    const separator = part.indexOf('=');
    if (separator > 0 && part.slice(0, separator).trim() === name) return decodeURIComponent(part.slice(separator + 1).trim());
  }
  return undefined;
}

export function preauthCookie(token: string, maxAge = 300): string {
  const clearing = maxAge === 0 && token === '';
  if ((!clearing && !/^[A-Za-z0-9_-]{64}$/.test(token)) || !Number.isSafeInteger(maxAge) || maxAge < 0 || maxAge > 300) {
    throw new Error('PREAUTH_COOKIE_INVALID');
  }
  const expiry = clearing ? '; Expires=Thu, 01 Jan 1970 00:00:00 GMT' : '';
  return `__Host-preauth=${encodeURIComponent(token)}; Path=/; Max-Age=${maxAge}; Secure; HttpOnly; SameSite=Strict${expiry}`;
}
