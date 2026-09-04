import type { QueryResult, QueryResultRow } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import type { OperationRequest } from '../../../../foundation/application/OperationHandler';
import type { OperationAction, OperationDatabase } from '../../../../foundation/application/ModuleOperations';
import { EXPERIENCE_OPERATOR_OPERATION_IDS, experienceOperatorActions } from '../../03_application_yingyong/ExperienceOperatorOperations';

describe('identity operator experience operations', () => {
  it('contains only the four approved application operations', () => {
    expect(EXPERIENCE_OPERATOR_OPERATION_IDS).toEqual(['experience.applications.create', 'experience.applications.read', 'experience.applications.update', 'experience.applications.copy']);
    expect(Object.keys(experienceOperatorActions()).sort()).toEqual([...EXPERIENCE_OPERATOR_OPERATION_IDS].sort());
  });

  it('creates a draft application at version zero and returns 201', async () => {
    const created = application({ id: 'application:new', name: '新应用', status: 'draft', version: 0 });
    const query = vi.fn().mockResolvedValue(result([created]));
    const response = await action('experience.applications.create')(request('experience.applications.create', { name: ' 新应用 ', code: 'NEW_APP', publicSlug: 'new-app' }), { query } as unknown as OperationDatabase);

    expect(response).toMatchObject({ status: 201, body: { status: 'draft', version: 0 } });
    expect(query).toHaveBeenCalledTimes(1);
    expect(String(query.mock.calls[0]?.[0])).toContain("values($1,$2,$3,$4,$5,'draft'");
    expect(query.mock.calls[0]?.[1]).toEqual([expect.stringMatching(/^application:/), 'platform:one', 'NEW_APP', 'new-app', '新应用']);
    expect(String(query.mock.calls[0]?.[0])).not.toMatch(/experience\.(version|release|binding)/);
  });

  it('updates only the name with the current expected version', async () => {
    const updated = application({ name: '新名称', version: 8 });
    const query = vi.fn().mockResolvedValue(result([updated]));
    const response = await action('experience.applications.update')(request('experience.applications.update', { name: ' 新名称 ' }, 7, { applicationid: 'application:one' }), { query } as unknown as OperationDatabase);

    expect(response).toMatchObject({ status: 200, body: { name: '新名称', version: 8 } });
    expect(String(query.mock.calls[0]?.[0])).toContain('where id=$1 and version=$4');
    expect(query.mock.calls[0]?.[1]).toEqual(['application:one', '新名称', null, 7]);
  });

  it('requires expectedVersion before an application update', async () => {
    const query = vi.fn();
    await expect(action('experience.applications.update')(request('experience.applications.update', { name: '新名称' }, undefined, { applicationid: 'application:one' }), { query } as unknown as OperationDatabase)).rejects.toThrow(
      'EXPECTED_VERSION_REQUIRED'
    );
    expect(query).not.toHaveBeenCalled();
  });

  it('returns VERSION_CONFLICT for a stale expected version', async () => {
    const query = vi.fn().mockResolvedValue(result([]));
    await expect(action('experience.applications.update')(request('experience.applications.update', { name: '新名称' }, 6, { applicationid: 'application:one' }), { query } as unknown as OperationDatabase)).rejects.toThrow(
      'VERSION_CONFLICT'
    );
  });

  it('disables with PATCH semantics and never issues SQL DELETE', async () => {
    const disabled = application({ status: 'disabled', version: 9 });
    const query = vi.fn().mockResolvedValue(result([disabled]));
    await action('experience.applications.update')(request('experience.applications.update', { status: 'disabled' }, 8, { applicationid: 'application:one' }), { query } as unknown as OperationDatabase);

    expect(query.mock.calls[0]?.[1]).toEqual(['application:one', null, 'disabled', 8]);
    expect(String(query.mock.calls[0]?.[0])).not.toMatch(/\bdelete\b/i);
  });

  it('rejects status changes other than disable', async () => {
    const query = vi.fn();
    await expect(action('experience.applications.update')(request('experience.applications.update', { status: 'active' }, 8, { applicationid: 'application:one' }), { query } as unknown as OperationDatabase)).rejects.toThrow(
      'VALIDATION_FAILED:status'
    );
    expect(query).not.toHaveBeenCalled();
  });

  it('copies only the current head into sequence one without release or history writes', async () => {
    const copiedApplication = application({ id: 'application:copy', name: '副本', status: 'draft', version: 0 });
    const query = vi
      .fn()
      .mockResolvedValueOnce(result([copiedApplication]))
      .mockResolvedValueOnce(result([{ id: 'version:copy' }]))
      .mockResolvedValueOnce(result([]));
    const response = await action('experience.applications.copy')(
      request(
        'experience.applications.copy',
        {
          name: '副本',
          code: 'COPY_APP',
          publicSlug: 'copy-app',
          reason: '验收复制',
        },
        undefined,
        { applicationid: 'application:source' }
      ),
      { query } as unknown as OperationDatabase
    );

    expect(response).toMatchObject({
      status: 201,
      body: { status: 'draft', version: 0, versionId: expect.stringMatching(/^version:/) },
    });
    expect(query).toHaveBeenCalledTimes(3);
    expect(String(query.mock.calls[1]?.[0])).toContain('source.head_version_id');
    expect(String(query.mock.calls[1]?.[0])).toContain('select $1,$2,1,version.schema_version,version.configuration,version.configuration_hash,version.validation_state');
    expect(query.mock.calls[1]?.[1]).toEqual([expect.stringMatching(/^version:/), expect.stringMatching(/^application:/), '验收复制', 'actor:operator', 'application:source']);
    expect(query.mock.calls.map((call) => String(call[0])).join('\n')).not.toMatch(/\b(delete|release)\b/i);
  });

  it('does not fabricate a copy when the source has no head version', async () => {
    const query = vi.fn().mockResolvedValue(result([]));
    await expect(
      action('experience.applications.copy')(
        request(
          'experience.applications.copy',
          {
            name: '副本',
            code: 'COPY_APP',
            publicSlug: 'copy-app',
            reason: '验收复制',
          },
          undefined,
          { applicationid: 'application:empty' }
        ),
        { query } as unknown as OperationDatabase
      )
    ).rejects.toThrow('EXPERIENCE_SOURCE_APPLICATION_INVALID');
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('preserves database uniqueness failures without overwriting an existing identity', async () => {
    const duplicate = Object.assign(new Error('duplicate key value violates unique constraint'), { code: '23505' });
    const query = vi.fn().mockRejectedValue(duplicate);
    await expect(action('experience.applications.create')(request('experience.applications.create', { name: '重复应用', code: 'DUP_APP', publicSlug: 'dup-app' }), { query } as unknown as OperationDatabase)).rejects.toBe(duplicate);
    expect(query).toHaveBeenCalledTimes(1);
  });
});

function action(operation: string): OperationAction {
  const selected = (experienceOperatorActions() as Readonly<Record<string, unknown>>)[operation];
  if (typeof selected !== 'function') throw new Error(`TEST_OPERATION_MISSING:${operation}`);
  return selected as OperationAction;
}

function request(type: string, body: Readonly<Record<string, unknown>>, expectedVersion?: number, path: Readonly<Record<string, string>> = {}): OperationRequest {
  return {
    type,
    access: {
      actor: { id: 'actor:operator', target: 'identity' },
      membership: { id: 'membership:operator' },
      scope: { id: 'platform:one', kind: 'platform' },
      trace: 'trace:experience',
    },
    input: {
      path,
      query: {},
      headers: {},
      body,
      rawBody: JSON.stringify(body),
      deadline: Date.now() + 5_000,
      signal: new AbortController().signal,
      idempotency: `idempotency:${type}`,
      ...(expectedVersion === undefined ? {} : { expectedVersion }),
    },
  } as unknown as OperationRequest;
}

function application(overrides: Readonly<Record<string, unknown>> = {}): Readonly<Record<string, unknown>> {
  return {
    id: 'application:one',
    scope_id: 'platform:one',
    code: 'APP_ONE',
    public_slug: 'app-one',
    name: '应用一',
    status: 'active',
    version: 7,
    ...overrides,
  };
}

function result<T extends QueryResultRow>(rows: readonly T[]): QueryResult<T> {
  return { rows: [...rows], rowCount: rows.length, command: '', oid: 0, fields: [] };
}
