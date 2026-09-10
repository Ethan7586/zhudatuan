import { describe, expect, it } from 'vitest';
import { shouldRevalidateScope } from './Router';

describe('console scope revalidation', () => {
  it('keeps the validated parent scope while navigating between child features', () => {
    expect(shouldRevalidateScope(argumentsFor('/scopes/group/one/dashboard', '/scopes/group/one/orders'))).toBe(false);
  });

  it('revalidates when the scope changes, a command submitted, or the current page explicitly refreshes', () => {
    expect(shouldRevalidateScope(argumentsFor('/scopes/group/one/dashboard', '/scopes/mall/two/dashboard', { nextParams: { scopeKind: 'mall', scopeId: 'two' } }))).toBe(true);
    expect(shouldRevalidateScope(argumentsFor('/scopes/group/one/orders', '/scopes/group/one/orders', { formMethod: 'POST' }))).toBe(true);
    expect(shouldRevalidateScope(argumentsFor('/scopes/group/one/orders', '/scopes/group/one/orders', { defaultShouldRevalidate: true }))).toBe(true);
  });
});

function argumentsFor(current: string, next: string, overrides: Readonly<Record<string, unknown>> = {}) {
  return {
    currentParams: { scopeKind: 'group', scopeId: 'one' },
    nextParams: { scopeKind: 'group', scopeId: 'one' },
    currentUrl: new URL(current, 'https://console.yengze.press'),
    nextUrl: new URL(next, 'https://console.yengze.press'),
    formMethod: undefined,
    defaultShouldRevalidate: true,
    ...overrides,
  } as never;
}
