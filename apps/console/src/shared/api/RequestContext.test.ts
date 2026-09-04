// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { NAVIGATION_CATALOG_HASH } from '../../generated/NavigationBinding';
import { consoleCommand, consoleRequest, consoleStream } from './RequestContext';

describe('Console SDK request context', () => {
  it('creates an immutable read context with canonical SDK fields and no private header map', () => {
    const signal = new AbortController().signal;
    const context = consoleRequest({ kind: 'mall', id: 'mall:one' }, signal, 7, { ifNoneMatch: '"etag:one"', cachedResponse: { value: 1 } });

    expect(context).toMatchObject({ target: 'console', catalogVersion: NAVIGATION_CATALOG_HASH, scope: { kind: 'mall', id: 'mall:one' }, accessVersion: 7, signal, ifNoneMatch: '"etag:one"' });
    expect('headers' in context).toBe(false);
    expect(Object.isFrozen(context)).toBe(true);
    expect(Object.isFrozen(context.scope)).toBe(true);
  });

  it('carries the API session CSRF value for cross-subdomain writes', () => {
    const context = consoleCommand(undefined, {
      accessVersion: 7,
      csrfToken: 'csrf-token-from-api-session',
    });

    expect(context.csrfToken).toBe('csrf-token-from-api-session');
    expect(context.accessVersion).toBe(7);
    expect(context.idempotencyKey).toBeTruthy();
  });

  it('keeps stream resume state in the SDK LastEventId field', () => {
    const context = consoleStream({ kind: 'enterprise', id: 'enterprise:one' }, 8, undefined, 'event:42');

    expect(context).toMatchObject({ target: 'console', accessVersion: 8, lastEventId: 'event:42' });
    expect(context.idempotencyKey).toBeUndefined();
  });
});
