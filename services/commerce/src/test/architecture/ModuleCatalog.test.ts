import { describe, expect, it } from 'vitest';
import { OperationCatalog } from '@shop/contract';
import { BUSINESS_MODULES, COMMERCE_MODULES, SUPPORT_MODULES } from '../../app/modules';

describe('bounded-context catalog', () => {
  it('contains exactly twenty-nine business modules and one Navigation support module', () => {
    expect(BUSINESS_MODULES).toHaveLength(29);
    expect(COMMERCE_MODULES).toHaveLength(32);
    expect(new Set(BUSINESS_MODULES.map(({ id }) => id)).size).toBe(29);
    expect(SUPPORT_MODULES.map(({ id }) => id)).toEqual(['navigation']);
  });

  it('owns every contract operation and declares only existing dependencies', () => {
    const modules = new Set(COMMERCE_MODULES.map(({ id }) => id));
    for (const operation of OperationCatalog.all()) expect(modules.has(operation.module), operation.id).toBe(true);
    for (const module of COMMERCE_MODULES) for (const dependency of module.dependencies) expect(modules.has(dependency), `${module.id}->${dependency}`).toBe(true);
  });

  it('does not duplicate method and path pairs', () => {
    const keys = OperationCatalog.all().map(({ method, path }) => `${method} ${path}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
