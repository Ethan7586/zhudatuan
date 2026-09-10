import { randomUUID } from 'node:crypto';
import { DatabaseHarness } from '@shop/testing';
import { Client } from 'pg';
import { describe, expect, it } from 'vitest';
import type { AuthenticatedActor } from '../../src/foundation/security/AccessContext';
import { AccessPipeline } from '../../src/foundation/security/AccessPipeline';
import {
  PgAccessVersionResolver,
  PgCapabilityResolver,
  PgMembershipResolver,
  PgScopeResolver,
} from '../../src/foundation/security/PgAccessResolvers';
import type { DatabasePool } from '../../src/foundation/persistence/Pool';

const connection = process.env.SHOP_TEST_DATABASE_URL;
const endpointAvailable = connection !== undefined || process.env.PGHOST !== undefined;

describe.runIf(endpointAvailable)('PostgreSQL repository contract', () => {
  it('enforces inbox replay, job lease exclusion and scope RLS on the real target schema', async () => {
    const client = new Client({ ...(connection === undefined ? {} : { connectionString: connection }), connectionTimeoutMillis: 5_000, statement_timeout: 15_000 });
    const second = new Client({ ...(connection === undefined ? {} : { connectionString: connection }), connectionTimeoutMillis: 5_000, statement_timeout: 15_000 });
    const suffix = randomUUID();
    const job = `repository:${suffix}`;
    const event = `repository:${suffix}`;
    const harness = new DatabaseHarness({
      name: 'postgres-target',
      apply: async () => { await Promise.all([client.connect(), second.connect()]); },
      reset: async () => {
        await client.query('rollback').catch(() => undefined);
        await second.query('rollback').catch(() => undefined);
        await client.query('delete from runtime.job where id=$1', [job]).catch(() => undefined);
        await client.query('delete from runtime.inbox where event_id=$1', [event]).catch(() => undefined);
        await Promise.allSettled([client.end(), second.end()]);
      },
    });
    await harness.run(async () => {
      const firstInbox = await client.query<{ accepted: boolean }>("select runtime.accept_inbox('repository-contract',$1,'payment.succeeded',1,'trace', '{}'::jsonb) accepted", [event]);
      const replayedInbox = await client.query<{ accepted: boolean }>("select runtime.accept_inbox('repository-contract',$1,'payment.succeeded',1,'trace', '{}'::jsonb) accepted", [event]);
      expect(firstInbox.rows[0]?.accepted).toBe(true);
      expect(replayedInbox.rows[0]?.accepted).toBe(false);

      await client.query(`insert into runtime.job(id,kind,owner,payload,state,priority,available_at,created_at,updated_at)
        values($1,'repositorycontract','runtime','{}','queued',1,clock_timestamp(),clock_timestamp(),clock_timestamp())`, [job]);
      await client.query('begin');
      const firstClaim = await client.query<{ id: string }>("select id from runtime.claim_job('repositorycontract','worker-one',1,30)");
      const competingClaim = await second.query<{ id: string }>("select id from runtime.claim_job('repositorycontract','worker-two',1,30)");
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

  it('keeps the platform Owner operator on organization scope for member-only profile access', async () => {
    const client = new Client({ ...(connection === undefined ? {} : { connectionString: connection }), connectionTimeoutMillis: 5_000, statement_timeout: 15_000 });
    await client.connect();
    try {
      const owner = await client.query<{ membership_id: string; member_id: string; organization_id: string; access_version: number; account_id: string; realm_id: string }>(`
        select platformowner.membership_id,membership.member_id,membership.organization_id,membership.access_version,membership.account_id,membership.realm_id
        from access.platformowner platformowner
        join access.membership membership on membership.id=platformowner.membership_id and membership.status='active'
        where platformowner.singleton=true and platformowner.state='active'`);
      expect(owner.rows).toHaveLength(1);
      const row = owner.rows[0]!;
      const database = { query: client.query.bind(client) } as unknown as DatabasePool;
      const actor: AuthenticatedActor = Object.freeze({
        id: 'actor:platform-owner:repository-contract',
        account: row.account_id,
        realm: row.realm_id,
        session: 'session:platform-owner:repository-contract',
        membership: row.membership_id,
        credentialVersion: 1,
        accessVersion: row.access_version,
        target: 'console',
        assurance: { level: 2 },
      });
      const decisions: unknown[] = [];
      const pipeline = new AccessPipeline(
        { resolve: async () => actor },
        new PgMembershipResolver(database),
        new PgAccessVersionResolver(database),
        new PgScopeResolver(database),
        new PgCapabilityResolver(database),
        { now: () => new Date() },
        { evaluate: async () => ({ outcome: 'allow', safeReason: 'policy', decision: null }) },
        { append: async (decision) => { decisions.push(decision); } },
      );

      await expect(new PgScopeResolver(database).resolve(actor, 'member.profile.read')).resolves.toMatchObject({
        kind: 'tenant', id: row.organization_id,
      });
      await expect(pipeline.authorize({}, 'member.profile.read', 'member.profile.read', undefined)).rejects.toThrow('SCOPE_DENIED');
      expect(decisions).toContainEqual(expect.objectContaining({
        operation: 'member.profile.read',
        outcome: 'deny',
        reason: 'SCOPE_DENIED',
      }));
    } finally {
      await client.end();
    }
  });
});

describe.skipIf(endpointAvailable)('PostgreSQL repository contract', () => {
  it('fails closed when the mandatory integration endpoint is absent', () => {
    throw new Error('POSTGRES_REPOSITORY_ENDPOINT_REQUIRED');
  });
});
