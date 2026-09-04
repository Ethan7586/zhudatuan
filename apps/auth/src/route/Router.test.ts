// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { RouteRegistry } from '../app/RouteRegistry';
import { ROUTES } from '../generated/RouteBinding';

describe('auth route registry', () => {
  it('assembles every generated route exactly once through a feature manifest', () => {
    const ids = RouteRegistry.all().map(({ routeid }) => routeid);
    expect(new Set(ids).size).toBe(ids.length);
    expect([...ids].sort()).toEqual(Object.keys(ROUTES).sort());
  });
});
