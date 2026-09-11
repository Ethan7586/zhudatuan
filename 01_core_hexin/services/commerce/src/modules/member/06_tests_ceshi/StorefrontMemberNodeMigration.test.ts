import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { describe, expect, it } from 'vitest';

const migrationPath = resolve(
  process.cwd(),
  '../../../02_platform_pingtai/database/supabase/migrations/20260912120000_bind_storefront_members_to_hosted_nodes.sql',
);

describe('storefront member hosted-node migration', () => {
  it('binds self-registration to its Mall and invited consumers to the next real level', async () => {
    const database = new PGlite({ extensions: { pgcrypto } });
    try {
      await database.exec(bootstrap);
      await database.exec(await readFile(migrationPath, 'utf8'));
      await database.exec(`
        insert into access.membership(id,member_id,organization_id,client,status,realm_id,joined_at)
        values('membership:self','member:self','mall:one','storefront','active','realm:mall-one','2026-09-12T00:00:00Z');
      `);
      const self = await database.query<{ signed_level: string; parent_node_id: string }>(`
        select signed_level,parent_node_id from organization.provision_storefront_member_node(
          'membership:self',null,'principal:self','trace:self','node:self','2026-09-12T00:00:00Z'
        )
      `);
      expect(self.rows[0]).toEqual({ signed_level: 'L6', parent_node_id: 'node:mall-one:l1' });

      await database.exec(`
        insert into access.membership(id,member_id,organization_id,client,status,realm_id,joined_at)
        values('membership:invited','member:invited','mall:one','storefront','active','realm:mall-one','2026-09-12T00:01:00Z');
      `);
      const invited = await database.query<{ signed_level: string; parent_node_id: string }>(`
        select signed_level,parent_node_id from organization.provision_storefront_member_node(
          'membership:invited','membership:self','principal:invited','trace:invited','node:invited','2026-09-12T00:01:00Z'
        )
      `);
      expect(invited.rows[0]?.signed_level).toBe('L7');
      expect(invited.rows[0]?.parent_node_id).toBe((await database.query<{ node_id: string }>(
        `select node_id from access.membership where id='membership:self'`,
      )).rows[0]?.node_id);

      await database.exec(`
        insert into referral.member(id,scope_id,member_id,state)
        values('referral:invited','mall:one','member:invited','active');
        insert into access.membership(id,member_id,organization_id,client,status,realm_id,joined_at)
        values('membership:rebound','member:rebound','mall:one','storefront','active','realm:mall-one','2026-09-12T00:02:00Z');
        select * from organization.provision_storefront_member_node(
          'membership:rebound',null,'principal:rebound','trace:rebound','node:rebound','2026-09-12T00:02:00Z'
        );
      `);
      const rebound = await database.query<{ signed_level: string; relation_version: number }>(`
        select signed_level,relation_version from organization.bind_storefront_member_parent(
          'mall:one','member:rebound','referral:invited','principal:rebound','trace:bind','2026-09-12T00:03:00Z'
        )
      `);
      expect(rebound.rows[0]).toEqual({ signed_level: 'L8', relation_version: 2 });
      expect((await database.query<{ count: string }>(
        `select count(*)::text count from organization.storefrontmembernodechange`,
      )).rows[0]?.count).toBe('1');
    } finally {
      await database.close();
    }
  });

  it('backfills existing invitation topology without assigning every member to L6', async () => {
    const database = new PGlite({ extensions: { pgcrypto } });
    try {
      await database.exec(bootstrap);
      await database.exec(`
        insert into access.membership(id,member_id,organization_id,client,status,realm_id,joined_at) values
          ('membership:parent','member:parent','mall:one','storefront','active','realm:mall-one','2026-09-10T00:00:00Z'),
          ('membership:child','member:child','mall:one','storefront','active','realm:mall-one','2026-09-11T00:00:00Z');
        insert into referral.member(id,scope_id,member_id,state)
        values('referral:parent','mall:one','member:parent','active');
        insert into referral.binding(id,scope_id,customer_member_id,referral_member_id,bound_at,expires_at)
        values('binding:child','mall:one','member:child','referral:parent','2026-09-11T00:00:00Z',null);
      `);
      await database.exec(await readFile(migrationPath, 'utf8'));
      const levels = await database.query<{ id: string; signed_level: string }>(`
        select membership.id,relation.signed_level
        from access.membership membership
        join organization.noderelation relation on relation.node_id=membership.node_id
          and relation.superseded_at is null
        order by membership.id
      `);
      expect(levels.rows).toEqual([
        { id: 'membership:child', signed_level: 'L7' },
        { id: 'membership:parent', signed_level: 'L6' },
      ]);
    } finally {
      await database.close();
    }
  });
});

const bootstrap = `
create extension if not exists pgcrypto;
create role zhudatuanidentityapi nologin;
create role shopapp nologin;
create schema runtime;
create schema identity;
create schema access;
create schema referral;
create schema organization;
create table runtime.schemaversion(version text primary key,checksum text not null);
insert into runtime.schemaversion values(
  '20260912010000','ad04df36d3de44bec0b507e5af342395e1833bf04862be74679545c1cb0be26a'
);
create table identity.realm(
  id text primary key,node_id text not null unique,status text not null,created_at timestamptz not null,
  updated_at timestamptz not null,version bigint not null default 0,node_profile text not null,mall_id text,
  host_node_id text,host_node_profile text,unique(id,node_profile),unique(node_id,node_profile)
);
create table organization.node(
  id text primary key,line_id text not null,sovereignty_tier text not null,node_profile text not null,
  realm_id text not null unique references identity.realm(id),mall_id text,status text not null,
  created_at timestamptz not null,updated_at timestamptz not null,unique(id,line_id),unique(id,line_id,sovereignty_tier)
);
create table organization.noderelation(
  line_id text not null,node_id text not null,parent_node_id text,original_parent_node_id text,
  signed_level text not null,host_sovereign_node_id text not null,host_sovereignty_tier text not null default 'sovereign',
  relation_version bigint not null,effective_at timestamptz not null,superseded_at timestamptz,
  primary key(line_id,node_id,relation_version)
);
create table access.membership(
  id text primary key,member_id text not null,organization_id text not null,client text not null,status text not null,
  realm_id text not null,joined_at timestamptz
);
create table referral.member(id text primary key,scope_id text not null,member_id text not null,state text not null);
create table referral.binding(
  id text primary key,scope_id text not null,customer_member_id text not null,referral_member_id text not null,
  bound_at timestamptz not null,expires_at timestamptz
);
create table organization.hostednodeprovisioning(
  idempotency_key text primary key,node_id text not null unique,relation_version bigint not null
);
create function organization.provision_hosted_node(p_request jsonb)
returns table(
  line_id text,node_id text,sovereignty_tier text,node_profile text,realm_id text,mall_id text,status text,
  created_at text,parent_node_id text,original_parent_node_id text,signed_level text,host_sovereign_node_id text,
  relation_version integer,effective_at text,superseded_at text,idempotency_key text,request_hash text,
  requested_by text,trace_id text,replayed boolean
)
language plpgsql as $body$
begin
  insert into organization.node(
    id,line_id,sovereignty_tier,node_profile,realm_id,mall_id,status,created_at,updated_at
  ) values(
    p_request->>'node_id','line:test','hosted',p_request->>'node_profile',p_request->>'realm_id',null,'active',
    (p_request->>'effective_at')::timestamptz,(p_request->>'effective_at')::timestamptz
  );
  insert into organization.noderelation(
    line_id,node_id,parent_node_id,original_parent_node_id,signed_level,host_sovereign_node_id,relation_version,effective_at
  ) values(
    'line:test',p_request->>'node_id',p_request->>'parent_node_id',p_request->>'parent_node_id',
    p_request->>'signed_level','node:mall-one:l1',1,(p_request->>'effective_at')::timestamptz
  );
  insert into organization.hostednodeprovisioning values(p_request->>'idempotency_key',p_request->>'node_id',1);
  return query select 'line:test',p_request->>'node_id','hosted','consumer',p_request->>'realm_id',null,'active',
    p_request->>'effective_at',p_request->>'parent_node_id',p_request->>'parent_node_id',p_request->>'signed_level',
    'node:mall-one:l1',1,p_request->>'effective_at',null,p_request->>'idempotency_key','hash',
    p_request->>'requested_by',p_request->>'trace_id',false;
end
$body$;
insert into identity.realm(
  id,node_id,status,created_at,updated_at,node_profile,mall_id,host_node_id,host_node_profile
) values(
  'realm:mall-one','node:mall-one:l1','active','2026-09-01T00:00:00Z','2026-09-01T00:00:00Z',
  'operating_mall',null,null,null
);
insert into organization.node(
  id,line_id,sovereignty_tier,node_profile,realm_id,mall_id,status,created_at,updated_at
) values(
  'node:mall-one:l1','line:test','sovereign','operating_mall','realm:mall-one',null,'active',
  '2026-09-01T00:00:00Z','2026-09-01T00:00:00Z'
);
insert into organization.noderelation(
  line_id,node_id,parent_node_id,original_parent_node_id,signed_level,host_sovereign_node_id,relation_version,effective_at
) values('line:test','node:mall-one:l1',null,null,'L1','node:mall-one:l1',1,'2026-09-01T00:00:00Z');
`;
