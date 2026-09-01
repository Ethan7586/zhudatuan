import { describe, expect, it } from 'vitest';
import { resolveBuildInfo } from './BuildInfo';

describe('resolveBuildInfo', () => {
  it('keeps the commit, API and database identity in one traceable label', () => {
    const value = resolveBuildInfo({
      commit: '0db535e2475c017dda8bb055344a240f6e2ae1b9',
      branch: 'codex/product-000a-baseline-isolation',
      id: '0db535e2475c',
      dirty: false,
      database: 'zhudatuan_product_000',
      apiOrigin: 'http://127.0.0.1:3211',
    });

    expect(value.footerLabel).toBe('Build 0db535e2475c · DB zhudatuan_product_000');
    expect(value.detailLabel).toContain('commit=0db535e2475c017dda8bb055344a240f6e2ae1b9');
    expect(value.detailLabel).toContain('api=http://127.0.0.1:3211');
  });

  it('reports missing runtime bindings instead of inventing provenance', () => {
    const value = resolveBuildInfo({ commit: 'abc123', dirty: true });

    expect(value.footerLabel).toBe('Build abc123-dirty · DB 未绑定');
    expect(value.apiOrigin).toBe('未绑定');
  });
});
