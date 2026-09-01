// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { consoleCommand } from './Client';

describe('Console command context', () => {
  it('carries the API session CSRF value for cross-subdomain writes', () => {
    const context = consoleCommand(undefined, {
      accessVersion: 7,
      csrfToken: 'csrf-token-from-api-session',
    });

    expect(context.csrfToken).toBe('csrf-token-from-api-session');
    expect(context.accessVersion).toBe(7);
    expect(context.idempotencyKey).toBeTruthy();
  });
});
