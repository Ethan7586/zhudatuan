function loopbackOrigin(name: string, fallback: string): string {
  const value = process.env[name]?.trim() || fallback;
  const origin = new URL(value);
  if (origin.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(origin.hostname)
    || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) {
    throw new Error(`E2E_ORIGIN_INVALID:${name}`);
  }
  return origin.origin;
}

export const API_ORIGIN = loopbackOrigin('E2E_API_ORIGIN', 'http://127.0.0.1:3001');
export const AUTH_ORIGIN = loopbackOrigin('E2E_AUTH_ORIGIN', 'http://127.0.0.1:4276');
export const CONSOLE_ORIGIN = loopbackOrigin('E2E_CONSOLE_ORIGIN', 'http://127.0.0.1:4273');
export const STOREFRONT_ORIGIN = loopbackOrigin('E2E_STOREFRONT_ORIGIN', 'http://127.0.0.1:4277');
