import { appConfig } from '../config/AppConfig';

export function consoleAuthUrl(): string {
  const destination = new URL('/', appConfig.authBaseUrl);
  destination.searchParams.set('target', 'console');
  return destination.toString();
}
