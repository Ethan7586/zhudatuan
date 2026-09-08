import { Client } from 'pg';
import { localSeedEnvironment } from '@shop/config/server';
import { KmsClient } from '../../../services/commerce/src/platform/secret/KmsClient';
import { localSecret } from './LocalSecrets';

const environment = localSeedEnvironment();
const purpose = process.argv[2] ?? 'login';
if (purpose !== 'login' && purpose !== 'stepup' && purpose !== 'enrollment') throw new Error('LOCAL_CHALLENGE_PURPOSE_INVALID');
const connectionString = await localSecret(environment.adminDatabaseConnectionRef);
const database = new Client({ connectionString });
await database.connect();
try {
  const result = await database.query<{ id: string; code_ciphertext: string }>(
    `select challenge.id,secret.code_ciphertext
       from identity.challenge challenge
       join identity.challengesecret secret on secret.challenge_id=challenge.id
      where challenge.purpose=$1 and challenge.consumed_at is null and challenge.attempts<10
        and challenge.expires_at>clock_timestamp()
      order by challenge.created_at desc limit 1`,
    [purpose]
  );
  const value = result.rows[0];
  if (!value) throw new Error('LOCAL_CHALLENGE_MISSING');
  const kms = new KmsClient(environment.kmsEndpoint, environment.kmsBearerToken);
  const code = await kms.decrypt('pii', 'identity/challenge', value.code_ciphertext, { challenge: value.id, purpose });
  const membership = 'membership-platform-owner-ethan-v1';
  const scopeResult = await database.query<{ organization_id: string; access_version: string }>('select organization_id,access_version from access.membership where id=$1', [membership]);
  const scope = scopeResult.rows[0]?.organization_id;
  const authorization = await database.query('select capability_version,cardinality(operation_ids) operations from capability.membership_authorization($1)', [membership]);
  const navigation = scope ? await database.query('select min(capability_version) minimum,max(capability_version) maximum,count(*) capabilities from capability.navigation_capabilities($1)', [[scope]]) : { rows: [] };
  const platform = await database.query('select min(capability_version) minimum,max(capability_version) maximum,count(*) capabilities from capability.navigation_capabilities($1)', [['organization-platform-root']]);
  const scopes = await database.query('select scope_kind,count(*) count from organization.navigation_scopes($1) group by scope_kind order by scope_kind', [[membership]]);
  const operations = await database.query(
    "select operation_id from capability.membership_operations($1) where operation_id in('catalog.pools.read','voucher.credentialpools.list','voucher.credentialpools.create','channel.providers.read','member.profile.read','organization.layers.read') order by operation_id",
    [membership]
  );
  const permissions = await database.query(
    "select permission_code,effect from access.effective_permissions($1) where permission_code in('catalog.pool.read','voucher.cardlibrary.read','voucher.cardlibrary.manage','channel.provider.read','member.profile.read','organization.layer.read') order by permission_code",
    [membership]
  );
  process.stdout.write(
    JSON.stringify({
      challenge: value.id,
      code,
      scope,
      accessVersion: scopeResult.rows[0]?.access_version,
      authorization: authorization.rows[0],
      navigation: navigation.rows[0],
      platform: platform.rows[0],
      scopes: scopes.rows,
      operations: operations.rows,
      permissions: permissions.rows,
    })
  );
} finally {
  await database.end();
}
