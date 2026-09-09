import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { PGlite } from '@electric-sql/pglite';

const originalMigration = fileURLToPath(new URL(
  '../../../02_platform_pingtai/database/supabase/migrations/20260909062000_provision_autonode_identity_realm.sql',
  import.meta.url,
));
const ledgerRecoveryMigration = fileURLToPath(new URL(
  '../../../02_platform_pingtai/database/supabase/migrations/20260909062500_reconcile_autonode_identity_migration_ledger.sql',
  import.meta.url,
));
const reprovisionMigration = fileURLToPath(new URL(
  '../../../02_platform_pingtai/database/supabase/migrations/20260909063000_reprovision_disabled_autonode_identity_realm.sql',
  import.meta.url,
));

test('a disabled AutoNode identity fact can be reconfigured under the same stable request identity', async () => {
  const database = new PGlite();
  try {
    await database.exec(baseSchema);
    await database.exec(await readFile(originalMigration, 'utf8'));
    await database.exec(await readFile(ledgerRecoveryMigration, 'utf8'));
    await database.exec(await readFile(reprovisionMigration, 'utf8'));

    const first = identityFact('a');
    const initial = await provision(database, first);
    assert.equal(initial.status, 'active');
    assert.equal(initial.reconfigured, false);

    await database.query('select identity.disable_node_realm($1)', [first.activation_request_id]);
    const next = identityFact('b');
    const reconfigured = await provision(database, next);
    assert.equal(reconfigured.status, 'active');
    assert.equal(reconfigured.reconfigured, true);

    const replayed = await provision(database, next);
    assert.equal(replayed.reconfigured, false);
    const state = await database.query(`select provisioning.manifest_digest,provisioning.status,realm.status realm_status,
      (select count(*)::integer from identity.realmentry where realm_id=provisioning.realm_id and status='active') entries
      from identity.nodeprovisioning provisioning join identity.realm realm on realm.id=provisioning.realm_id`);
    assert.deepEqual(state.rows[0], {
      manifest_digest: next.manifest_digest,
      status: 'active',
      realm_status: 'active',
      entries: 3,
    });

    await database.query('select identity.disable_node_realm($1)', [next.activation_request_id]);
    await assert.rejects(provision(database, {
      ...next,
      realm: { ...next.realm, node_id: 'node:another:l1' },
    }), /AUTONODE_IDENTITY_REALM_IDEMPOTENCY_CONFLICT/);
  } finally {
    await database.close();
  }
});

async function provision(database, fact) {
  const result = await database.query('select identity.provision_node_realm($1::jsonb) receipt', [JSON.stringify(fact)]);
  return result.rows[0].receipt;
}

function identityFact(digestLetter) {
  return {
    schema_version: 'sfl.autonode-identity-realm-fact.v1',
    activation_request_id: 'activation:fixture:recoverable-l1',
    provisioning_request_id: 'provisioning:fixture:recoverable-l1',
    manifest_id: 'manifest:fixture-recoverable:l1:v1',
    manifest_digest: `sha256:${digestLetter.repeat(64)}`,
    realm: {
      id: 'realm:fixture-recoverable-l1',
      node_id: 'node:fixture-recoverable:l1',
      node_profile: 'operating_mall',
      mall_id: 'mall:fixture-recoverable',
      host_node_id: null,
    },
    entries: [
      { host: 'accounts.fixture-recoverable.invalid', kind: 'accounts', status: 'active' },
      { host: 'api.fixture-recoverable.invalid', kind: 'api', status: 'active' },
      { host: 'store.fixture-recoverable.invalid', kind: 'storefront', status: 'active' },
    ],
    targets: [{
      surface: 'admin',
      target: 'console-fixture-recoverable',
      membership_client: 'operator',
      membership_organization_id: 'organization:fixture-recoverable',
      application_slug: null,
      return_origin: 'https://console.fixture-recoverable.invalid',
      node_profile: 'operating_mall',
    }],
  };
}

const baseSchema = `
create schema runtime;
create schema identity;
create schema supabase_migrations;
create role zhudatuanprovisioningapi;
create table supabase_migrations.schema_migrations(
  version text primary key,
  statements text[] not null default array[]::text[],
  name text not null
);
create table runtime.schemaversion(
  version text primary key,
  checksum text not null,
  applied_at timestamptz not null default clock_timestamp()
);
insert into runtime.schemaversion(version,checksum)
values('20260909061000','c991df2e1432618d6f39763476e8473588891269231fe01373877422e3a7c6ba');
create table identity.realm(
  id text primary key,
  node_id text not null unique,
  status text not null check(status in('active','disabled')),
  created_at timestamptz not null,
  updated_at timestamptz not null,
  version bigint not null default 0 check(version>=0),
  node_profile text not null,
  mall_id text,
  host_node_id text,
  host_node_profile text,
  unique(id,node_profile),
  unique(node_id,node_profile),
  check(node_id ~ '^node:[a-z0-9][a-z0-9-]{0,62}:l[0-9]{1,3}$'),
  check((node_profile='operating_mall' and mall_id is not null and host_node_id is null and host_node_profile is null)
    or (node_profile='consumer' and mall_id is null and host_node_id is not null
      and host_node_profile='operating_mall' and host_node_id<>node_id))
);
create table identity.realmentry(
  host text primary key,
  realm_id text not null references identity.realm(id),
  kind text not null check(kind in('accounts','api','storefront')),
  status text not null check(status in('active','disabled')),
  created_at timestamptz not null,
  unique(realm_id,host),
  check(host=lower(host) and host ~ '^[a-z0-9.-]+$')
);
create table identity.realmtarget(
  realm_id text not null,
  surface text not null check(surface in('admin','consumer')),
  target text not null unique,
  membership_client text not null check(membership_client in('operator','storefront','store','supplier')),
  membership_organization_id text not null,
  application_slug text,
  return_origin text not null,
  created_at timestamptz not null,
  node_profile text not null,
  primary key(realm_id,target),
  foreign key(realm_id,node_profile) references identity.realm(id,node_profile),
  check(node_profile='operating_mall'
    or (node_profile='consumer' and surface='consumer' and membership_client='storefront')),
  check(target ~ '^[a-z0-9][a-z0-9-]{0,62}$'),
  check((surface='consumer' and membership_client='storefront' and application_slug is not null)
    or (surface='admin' and application_slug is null)),
  check(return_origin ~ '^https://[a-z0-9.-]+(?::[0-9]+)?(?:/[^[:space:]]*)?$')
);
`;
