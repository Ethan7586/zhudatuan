// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { commandContext, queryContext } from '../../src/shared/api/Context';
import { environment, expectCommandContext, expectQueryContext } from '../TestData';

describe('CSRF request context', () => {
  it('binds every command to target, device, CSRF token and a fresh idempotency key', () => {
    const first = commandContext(environment, 'console', 'csrf-token');
    const second = commandContext(environment, 'console', 'csrf-token');

    expectCommandContext(first, 'console');
    expectCommandContext(second, 'console');
    expect(second.idempotencyKey).not.toBe(first.idempotencyKey);
  });

  it('keeps query contexts free of command-only CSRF and idempotency data', () => {
    const signal = new AbortController().signal;
    const context = queryContext(environment, 'storefront', signal);

    expectQueryContext(context);
    expect(context.signal).toBe(signal);
  });
});
