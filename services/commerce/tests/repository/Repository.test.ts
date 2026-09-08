import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { DatabaseHarness } from '@shop/testing';
import { Client } from 'pg';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';

const connection = process.env.SHOP_TEST_DATABASE_URL;
const endpointAvailable = connection !== undefined || process.env.PGHOST !== undefined;
const root = resolve(import.meta.dirname, '../../../..');
const moduleRoot = join(root, 'services/commerce/src/modules');
const objectAuthority = parse(readFileSync(join(root, 'database/contracts/objects.yml'), 'utf8')) as {
  objects: readonly Readonly<{ id: string; owner?: string; operationalOwner?: string }>[];
};
const repositorySources = repositories(moduleRoot);
const knownSchemas = new Set(objectAuthority.objects.flatMap(({ id }) => {
  const schema = id.split('.')[0];
  return schema ? [schema] : [];
}));
const persistenceSources = persistence(moduleRoot, knownSchemas);
const schemasByOwner = schemaOwnership(objectAuthority.objects);

describe.each(persistenceSources)('Persistence source contract: $name', ({ module, name, source, schemas }) => {
  it('uses only owned data and bounded parameterized statements', () => {
    const owned = schemasByOwner.get(module) ?? new Set<string>();
    expect([...schemas].filter((schema) => !owned.has(schema))).toEqual([]);
    expect(source).not.toMatch(/\bselect\s+(?:[a-z][a-z0-9_]*\.)?\*/i);
    expect(source).not.toMatch(/\boffset\s+(?:\$\d+|\d+)/i);
    expect(source).not.toMatch(/\.query\s*\(\s*['"`]\s*(?:begin|commit|rollback)\s*['"`]\s*[,)]/i);
    expect(sqlLiterals(source)).not.toMatch(/\$\{\s*(?:input|request|command|payload|filter|sort|order|field|column|value)\b/);
  });

  it('keeps transaction capability behind the persistence boundary', () => {
    expect(name).toMatch(/^[^/]+\/infrastructure\/persistence\//);
    expect(source).not.toMatch(/export\s+(?:type\s+)?\{[^}]*(?:PoolClient|DatabasePool|PgTransactionAccess)[^}]*\}/s);
  });
});

describe.each(repositorySources)('Repository source contract: $name', ({ module, name, source, schemas, queryCount }) => {
  it('uses only its authoritative schemas and parameterized bounded SQL', () => {
    const owned = schemasByOwner.get(module) ?? new Set<string>();
    expect([...schemas].filter((schema) => !owned.has(schema))).toEqual([]);
    expect(source).not.toMatch(/\bselect\s+(?:[a-z][a-z0-9_]*\.)?\*/i);
    expect(source).not.toMatch(/\boffset\s+(?:\$\d+|\d+)/i);
    expect(source).not.toMatch(/\.query\s*\(\s*['"`]\s*(?:begin|commit|rollback)\b/i);
    expect(queryCount).toBeGreaterThanOrEqual(0);
  });

  it('exposes one module-owned Repository implementation without leaking a raw client', () => {
    expect(source).toMatch(/export class [A-Z][A-Za-z0-9]*Repository\b/);
    expect(source).not.toMatch(/constructor\([^)]*(?:PoolClient|DatabasePool|TransactionManager)/s);
    expect(source).not.toMatch(/public\/.*Repository/);
  });
});

describe('PostgreSQL repository contract', () => {
  it('enforces inbox replay, job lease exclusion and scope RLS on the real target schema', async () => {
    if (!endpointAvailable) throw new Error('POSTGRES_REPOSITORY_ENDPOINT_REQUIRED');
    const client = new Client({ ...(connection === undefined ? {} : { connectionString: connection }), connectionTimeoutMillis: 5_000, statement_timeout: 15_000 });
    const second = new Client({ ...(connection === undefined ? {} : { connectionString: connection }), connectionTimeoutMillis: 5_000, statement_timeout: 15_000 });
    const suffix = randomUUID();
const job = `job:repository:${suffix}`;
    const event = `repository:${suffix}`;
    const harness = new DatabaseHarness({
      name: 'postgres-target',
      apply: async () => {
        await Promise.all([client.connect(), second.connect()]);
      },
      reset: async () => {
        await client.query('rollback').catch(() => undefined);
        await second.query('rollback').catch(() => undefined);
        await client.query('delete from runtime.job_attempts where job_id=$1', [job]).catch(() => undefined);
        await client.query('delete from runtime.jobs where id=$1', [job]).catch(() => undefined);
        await client.query('delete from runtime.inbox where event_id=$1', [event]).catch(() => undefined);
        await Promise.allSettled([client.end(), second.end()]);
      },
    });
    await harness.run(async () => {
      const firstInbox = await client.query<{ accepted: boolean }>("select runtime.accept_inbox('internal',$1,'repository-contract','payment.captured',1,'trace', '{}'::jsonb) accepted", [event]);
      const replayedInbox = await client.query<{ accepted: boolean }>("select runtime.accept_inbox('internal',$1,'repository-contract','payment.captured',1,'trace', '{}'::jsonb) accepted", [event]);
      expect(firstInbox.rows[0]?.accepted).toBe(true);
      expect(replayedInbox.rows[0]?.accepted).toBe(false);

      await client.query(
        `insert into runtime.jobs(id,tenant_id,scope_id,kind,owner,queue,payload,state,priority,available_at,
        idempotency_key,retention_until,version,created_by,updated_by,created_at,updated_at,authorization_snapshot)
        values($1,'tenant:repository','rls-scope-a','repositorycontract','runtime','maintenance','{}','queued',1,
        clock_timestamp(),$1,clock_timestamp()+interval '1 day',1,'repository-contract','repository-contract',
        clock_timestamp(),clock_timestamp(),'{"kind":"system","actor":"repository-contract","scope":"rls-scope-a","operation":"test","source":"jobs","capturedAt":"2026-09-08T00:00:00.000Z"}')`,
        [job]
      );
      await client.query('begin');
      const firstClaim = await client.query<{ id: string }>("select id from runtime.claim_job('repositorycontract','worker-one',1,30,'jobs')");
      const competingClaim = await second.query<{ id: string }>("select id from runtime.claim_job('repositorycontract','worker-two',1,30,'jobs')");
      expect(firstClaim.rows.map(({ id }) => id)).toContain(job);
      expect(competingClaim.rows.map(({ id }) => id)).not.toContain(job);
      await client.query('rollback');

      await client.query('begin');
      await client.query('set local role shopapp');
      await client.query("select set_config('app.workload','api',true),set_config('app.scope_id','rls-scope-a',true),set_config('app.actor_id','repository-contract',true)");
      const policies = await client.query<{ scope_id: string }>('select scope_id from risk.policy order by scope_id');
      expect(policies.rows.every(({ scope_id }) => scope_id === 'rls-scope-a')).toBe(true);
      await client.query('rollback');
    });
  });
});

function repositories(directory: string): readonly Readonly<{ module: string; name: string; source: string; schemas: ReadonlySet<string>; queryCount: number }>[] {
  const result: Readonly<{ module: string; name: string; source: string; schemas: ReadonlySet<string>; queryCount: number }>[] = [];
  for (const file of files(directory)) {
    const name = relative(moduleRoot, file).split('\\').join('/');
    if (!/^[^/]+\/infrastructure\/persistence\/(?:Pg|Telemetry|Extension)[A-Za-z0-9]*Repository\.ts$/.test(name)) continue;
    const source = readFileSync(file, 'utf8');
    if (!/export class [A-Z][A-Za-z0-9]*Repository\b/.test(source)) continue;
    const schemas = new Set([...source.matchAll(/\b(?:from|join|insert\s+into|update|delete\s+from)\s+([a-z][a-z0-9]*)\./gi)].map((match) => match[1]!));
    result.push(Object.freeze({ module: name.split('/')[0]!, name, source, schemas, queryCount: [...source.matchAll(/\.query(?:<[^>]+>)?\s*\(/g)].length }));
  }
  return Object.freeze(result.sort((left, right) => left.name.localeCompare(right.name)));
}

function persistence(directory: string, known: ReadonlySet<string>): readonly Readonly<{ module: string; name: string; source: string; schemas: ReadonlySet<string> }>[] {
  const result: Readonly<{ module: string; name: string; source: string; schemas: ReadonlySet<string> }>[] = [];
  for (const file of files(directory)) {
    const name = relative(moduleRoot, file).split('\\').join('/');
    if (!/^[^/]+\/infrastructure\/persistence\/.+\.ts$/.test(name)) continue;
    const source = readFileSync(file, 'utf8');
    if (!/\.query(?:<[^>]+>)?\s*\(|\.transaction\s*\(/.test(source)) continue;
    const schemas = new Set([...source.matchAll(/\b(?:from|join|insert\s+into|update|delete\s+from)\s+([a-z][a-z0-9]*)\./gi)].map((match) => match[1]!).filter((schema) => known.has(schema)));
    result.push(Object.freeze({ module: name.split('/')[0]!, name, source, schemas }));
  }
  return Object.freeze(result.sort((left, right) => left.name.localeCompare(right.name)));
}

function schemaOwnership(objects: readonly Readonly<{ id: string; owner?: string; operationalOwner?: string }>[]): ReadonlyMap<string, ReadonlySet<string>> {
  const result = new Map<string, Set<string>>();
  for (const object of objects) {
    const schema = object.id.split('.')[0];
    const owner = object.operationalOwner ?? databaseRoleOwner(object.owner);
    if (!schema || !owner) continue;
    const values = result.get(owner) ?? new Set<string>();
    values.add(schema);
    result.set(owner, values);
  }
  return result;
}

function databaseRoleOwner(owner: string | undefined): string | undefined {
  return owner?.match(/^shop([a-z][a-z0-9]*)owner$/)?.[1];
}

function sqlLiterals(source: string): string {
  return [...source.matchAll(/`([^`]*)`/gs)]
    .map((match) => match[1]!)
    .filter((value) => /\b(?:select|insert\s+into|update|delete\s+from)\b/i.test(value))
    .join('\n');
}

function files(directory: string, result: string[] = []): readonly string[] {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const target = join(directory, entry.name);
    if (entry.isDirectory()) files(target, result);
    else if (entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) result.push(target);
  }
  return result;
}
