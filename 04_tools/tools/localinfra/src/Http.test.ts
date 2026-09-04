import { describe, expect, it } from 'vitest';
import { LocalHttpError, workloadBearerPreflight } from './Http';

const token = 'w'.repeat(43);
const authorize = workloadBearerPreflight(token);

describe('workload bearer transport preflight', () => {
  it('keeps only readiness anonymous', () => {
    expect(() => authorize(request('/health/ready'))).not.toThrow();
    expect(() => authorize(request('/health/not-ready'))).toThrowError(authenticationRequired());
  });

  it('rejects missing and wrong credentials before a request body is read', () => {
    expect(() => authorize(request('/not-a-route', undefined))).toThrowError(authenticationRequired());
    expect(() => authorize(request('/not-a-route', 'x'.repeat(43)))).toThrowError(authenticationRequired());
  });

  it('accepts the exact credential', () => {
    expect(() => authorize(request('/not-a-route', token))).not.toThrow();
  });
});

function request(path: string, bearer = ''): Readonly<{
  headers: Readonly<Record<string, string>>;
  method: string;
  url: URL;
}> {
  return Object.freeze({
    headers: bearer ? { authorization: `Bearer ${bearer}` } : {},
    method: 'POST',
    url: new URL(path, 'https://127.0.0.1'),
  });
}

function authenticationRequired(): LocalHttpError {
  return new LocalHttpError(401, 'WORKLOAD_AUTHENTICATION_REQUIRED');
}
