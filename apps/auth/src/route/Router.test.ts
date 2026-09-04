// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { RouteRegistry } from '../app/RouteRegistry';
import { ROUTES } from '../generated/RouteBinding';

describe('auth route registry', () => {
  it('assembles every generated route exactly once through a feature manifest', () => {
    const manifests = RouteRegistry.all();
    const ids = manifests.map(({ routeid }) => routeid);
    expect(new Set(ids).size).toBe(ids.length);
    expect([...ids].sort()).toEqual(Object.keys(ROUTES).sort());
    for (const manifest of manifests) {
      expect(manifest.operation).toMatch(/^identity\./);
      expect(manifest.capability).toBe(manifest.operation);
      expect(manifest.title).toMatch(/\p{Script=Han}/u);
      expect(manifest.breadcrumbs.length).toBeGreaterThan(0);
    }
  });
});
