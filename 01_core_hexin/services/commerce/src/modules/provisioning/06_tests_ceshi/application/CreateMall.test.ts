import { describe, expect, it } from 'vitest';
import type { QueryResult, QueryResultRow } from 'pg';
import type { OperationDatabase } from '../../../../foundation/application/ModuleOperations';
import { CreateMall } from '../../03_application_yingyong/CreateMall';

describe('mall provisioning engine', () => {
  it('allocates h6.fufuwang.com.cn when h5 is already reserved', async () => {
    const database = recordingDatabase([], () => []);

    await expect(new CreateMall().allocatePublicSlug(database)).resolves.toBe('h6');
  });

  it('advances through occupied H5 numbers under one allocation lock', async () => {
    const calls: QueryCall[] = [];
    const database = recordingDatabase(calls, (text) => text.startsWith('select greatest')
      ? [{ next_sequence: 8 }]
      : []);

    await expect(new CreateMall().allocatePublicSlug(database)).resolves.toBe('h8');
    expect(calls[0]?.text).toContain('pg_advisory_xact_lock');
    expect(calls[1]?.text).toContain('greatest(6');
    expect(calls[1]?.text).toContain("public_slug ~ '^h[0-9]+$'");
  });

  it('creates one independent L2 mall below an L1 mall with an empty product pool and valid storefront draft', async () => {
    const calls: QueryCall[] = [];
    const database = recordingDatabase(calls, (text) => {
      if (text.startsWith('select parent.id')) return [{ id: 'mall:l1' }];
      if (text.startsWith('select membership_id')) return [{
        membership_id: 'membership:mall-owner', member_id: 'member:owner', principal_id: 'principal:owner',
      }];
      return [];
    });
    const engine = new CreateMall();
    const plan = engine.plan({
      scope: 'mall:l1',
      parent: 'mall:l1',
      code: 'MALL_ONE',
      publicSlug: 'mall-one',
      name: '一号商城',
      actor: 'principal:owner',
      actorMembership: 'membership:source-owner',
    });

    expect(await engine.preflight(database, plan)).toBeNull();
    const created = await engine.execute(database, plan);

    expect(created).toEqual({
      organizationId: plan.mall,
      scopeId: plan.mall,
      mallId: plan.mall,
      parentId: 'mall:l1',
      enterpriseId: 'mall:l1',
      applicationId: plan.application,
      poolId: plan.pool,
      ownerMembershipId: 'membership:mall-owner',
      ownerMemberId: 'member:owner',
      ownerPrincipalId: 'principal:owner',
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
    expect(calls.find(({ text }) => text.startsWith('select parent.id'))?.text)
      .toContain("root.kind in('platform','mall')");
    const version = calls.find(({ text }) => text.startsWith('insert into experience.version'));
    expect(JSON.parse(String(version?.values[2]))).toMatchObject({ version: 2, application: plan.application });
  });

  it('locks the mall identity without requiring cross-module update privileges and stops before writes on conflict', async () => {
    const calls: QueryCall[] = [];
    const database = recordingDatabase(calls, (text) => {
      if (text.startsWith('select parent.id')) return [{ id: 'enterprise:one' }];
      if (text.startsWith('select 1 from organization.organization mall')) return [{ exists: 1 }];
      return [];
    });
    const engine = new CreateMall();
    const plan = engine.plan({
      scope: 'organization-platform-root', parent: 'enterprise:one', code: 'MALL_ONE',
      publicSlug: 'mall-one', name: '一号商城', actor: 'principal:owner', actorMembership: 'membership:owner',
    });

    expect(await engine.preflight(database, plan)).toBe('MALL_CODE_CONFLICT');
    expect(calls[0]?.text).toContain('pg_advisory_xact_lock');
    expect(calls[1]?.text).not.toContain('for update');
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
      scope: 'organization-platform-root', parent: 'enterprise:one', code: 'MALL_ONE',
      publicSlug: 'mall-one', name: '一号商城', actor: 'principal:owner', actorMembership: 'membership:owner',
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
