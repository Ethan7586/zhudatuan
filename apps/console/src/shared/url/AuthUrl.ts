import type { AuthTarget } from '@shop/config/client';
import { ROUTE_BY_ID } from '@shop/config/route';
import { appConfig } from '../config/AppConfig';

export function consoleAuthUrl(): string {
  const destination = new URL(authRoutePath('authlogin'), appConfig.authBaseUrl);
  destination.searchParams.set('target', 'console');
  return destination.toString();
}

export function invitationAuthUrl(target: AuthTarget): string {
  const destination = new URL(authRoutePath('authinvitation'), appConfig.authBaseUrl);
  destination.searchParams.set('target', target);
  return destination.toString();
}

function authRoutePath(id: 'authlogin' | 'authinvitation'): string {
  const route = ROUTE_BY_ID.get(id);
  if (route === undefined || route.surface !== 'auth') throw new Error(`AUTH_ROUTE_MISSING:${id}`);
  return route.path;
}
