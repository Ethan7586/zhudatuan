import { describe, expect, it } from 'vitest';
import type { QueryResult, QueryResultRow } from 'pg';
import type { OperationDatabase } from '../../../foundation/application/ModuleOperations';
import { CreateMall } from './CreateMall';

describe('mall provisioning engine', () => {
  it('creates one independent mall root, empty product pool and valid storefront draft', async () => {
    const calls: QueryCall[] = [];
    const database = recordingDatabase(calls, (text) => {
      if (text.startsWith('select parent.id')) return [{ id: 'enterprise:one' }];
      return [];
    });
    const engine = new CreateMall();
    const plan = engine.plan({
      scope: 'organization-platform-root',
      enterprise: 'enterprise:one',
      code: 'MALL_ONE',
      publicSlug: 'mall-one',
      name: '一号商城',
      actor: 'member:owner',
    });

    expect(await engine.preflight(database, plan)).toBeNull();
    const created = await engine.execute(database, plan);

    expect(created).toEqual({
      mallId: plan.mall,
      enterpriseId: 'enterprise:one',
      applicationId: plan.application,
      poolId: plan.pool,
      code: 'MALL_ONE',
      publicSlug: 'mall-one',
      name: '一号商城',
      state: 'ready',
      publicationState: 'draft',
    });
    expect(calls.some(({ text }) => text.startsWith('insert into organization.organization'))).toBe(true);
    expect(calls.some(({ text }) => text.startsWith('insert into catalog.pool('))).toBe(true);
    expect(calls.some(({ text }) => text.startsWith('insert into catalog.poolbinding'))).toBe(true);
    expect(calls.some(({ text }) => text.startsWith('insert into experience.application'))).toBe(true);
    expect(calls.some(({ text }) => text.startsWith('insert into experience.version'))).toBe(true);
    expect(calls.some(({ text }) => text.startsWith('insert into experience.binding'))).toBe(true);
    const pool = calls.find(({ text }) => text.startsWith('insert into catalog.pool('));
    const poolBinding = calls.find(({ text }) => text.startsWith('insert into catalog.poolbinding'));
    const application = calls.find(({ text }) => text.startsWith('insert into experience.application'));
    const binding = calls.find(({ text }) => text.startsWith('insert into experience.binding'));
    expect(pool?.values[1]).toBe(plan.mall);
    expect(poolBinding?.values[0]).toBe(plan.mall);
    expect(application?.values[1]).toBe(plan.mall);
    expect(binding?.values[2]).toBe(plan.mall);
    expect(calls.some(({ text }) => /insert into (?:catalog\.(?:product|sku|listing)|inventory\.|ordering\.|payment\.|finance\.)/.test(text)))
      .toBe(false);
    const version = calls.find(({ text }) => text.startsWith('insert into experience.version'));
    expect(JSON.parse(String(version?.values[2]))).toMatchObject({ version: 2, application: plan.application });
  });

  it('locks the platform root and stops before writes when the mall code exists', async () => {
    const calls: QueryCall[] = [];
    const database = recordingDatabase(calls, (text) => {
      if (text.startsWith('select parent.id')) return [{ id: 'enterprise:one' }];
      if (text.startsWith('select 1 from organization.organization mall')) return [{ exists: 1 }];
      return [];
    });
    const engine = new CreateMall();
    const plan = engine.plan({
      scope: 'organization-platform-root', enterprise: 'enterprise:one', code: 'MALL_ONE',
      publicSlug: 'mall-one', name: '一号商城', actor: 'member:owner',
    });

    expect(await engine.preflight(database, plan)).toBe('MALL_CODE_CONFLICT');
    expect(calls[0]?.text).toContain('for update of root,parent');
    expect(calls.some(({ text }) => text.startsWith('insert into'))).toBe(false);
  });

  it('uses stable identities and rejects a globally occupied public slug before writes', async () => {
    const calls: QueryCall[] = [];
    const database = recordingDatabase(calls, (text) => {
      if (text.startsWith('select parent.id')) return [{ id: 'enterprise:one' }];
      if (text.startsWith('select 1 from experience.application')) return [{ exists: 1 }];
      return [];
    });
    const engine = new CreateMall();
    const input = {
      scope: 'organization-platform-root', enterprise: 'enterprise:one', code: 'MALL_ONE',
      publicSlug: 'mall-one', name: '一号商城', actor: 'member:owner',
    } as const;
    const first = engine.plan(input);
    const second = engine.plan(input);

    expect(second).toEqual(first);
    expect(await engine.preflight(database, first)).toBe('MALL_PUBLIC_SLUG_CONFLICT');
    expect(calls.some(({ text }) => text.startsWith('insert into'))).toBe(false);
  });
});

interface QueryCall { readonly text: string; readonly values: readonly unknown[] }

function recordingDatabase(calls: QueryCall[], rows: (text: string) => readonly QueryResultRow[]): OperationDatabase {
  return {
    async query<R extends QueryResultRow>(text: string, values: readonly unknown[] = []): Promise<QueryResult<R>> {
      calls.push({ text, values });
      const result = rows(text) as R[];
      return { rows: result, rowCount: result.length } as QueryResult<R>;
    },
  };
}
