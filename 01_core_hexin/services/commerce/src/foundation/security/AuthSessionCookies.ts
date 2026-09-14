import type { AuthTarget } from '@shop/config/server';

export const AUTH_TARGET_CONTEXT_HEADER = 'x-sfl-auth-target-context';

const TARGETS = Object.freeze(['console', 'storefront', 'store', 'supplier'] as const satisfies readonly AuthTarget[]);

export function authTargetForSurface(surface: string): AuthTarget | undefined {
  const value = surface.startsWith('surface:') ? surface.slice('surface:'.length) : surface;
  return TARGETS.find((target) => target === value);
}

export function requestAuthTarget(headers: Readonly<Record<string, string>>): AuthTarget | undefined {
  const value = headers[AUTH_TARGET_CONTEXT_HEADER];
  return TARGETS.find((target) => target === value);
}

export function sessionCookieName(target: AuthTarget): string {
  return `shop_${target}_session`;
}

export function csrfCookieName(target: AuthTarget): string {
  return `shop_${target}_csrf`;
}

export function requestSessionCookie(headers: Readonly<Record<string, string>>): string | undefined {
  const target = requestAuthTarget(headers);
  return target === undefined
    ? cookieValue(headers.cookie, 'shop_session')
    : cookieValue(headers.cookie, sessionCookieName(target)) ?? cookieValue(headers.cookie, 'shop_session');
}

export function requestCsrfCookie(headers: Readonly<Record<string, string>>, target?: AuthTarget): string | undefined {
  const resolvedTarget = target ?? requestAuthTarget(headers);
  return resolvedTarget === undefined
    ? cookieValue(headers.cookie, 'shop_csrf')
    : cookieValue(headers.cookie, csrfCookieName(resolvedTarget)) ?? cookieValue(headers.cookie, 'shop_csrf');
}

export function requestSessionCookieCandidates(value: string | undefined): readonly string[] {
  const candidates = [
    ...TARGETS.map((target) => cookieValue(value, sessionCookieName(target))),
    cookieValue(value, 'shop_session'),
  ].filter((candidate): candidate is string => candidate !== undefined);
  return Object.freeze([...new Set(candidates)]);
}

export function cookieValue(value: string | undefined, name: string): string | undefined {
  for (const part of value?.split(';') ?? []) {
    const separator = part.indexOf('=');
    if (separator > 0 && part.slice(0, separator).trim() === name) {
      return decodeURIComponent(part.slice(separator + 1).trim());
    }
  }
  return undefined;
}
