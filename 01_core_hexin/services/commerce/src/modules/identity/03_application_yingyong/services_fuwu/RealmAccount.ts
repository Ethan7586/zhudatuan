import { identityEntryHost, type AuthTarget, type IdentityRealmContext } from '@shop/config/server';
import { parseActiveRealmMembershipContext, type ActiveRealmMembershipContext } from '@shop/config/sfl-node-kernel';
import { reject, type OperationDatabase } from '../../../../foundation/application/ModuleOperations';

export interface RealmNodeContext {
  readonly realmId: string;
  readonly nodeId: string;
  readonly entryHost: string;
}

export interface RealmAccountContext {
  readonly accountId: string;
  readonly realmId: string;
  readonly principalId: string;
  readonly credentialVersion: number;
}

export async function resolveActiveMembershipContext(
  database: OperationDatabase,
  entryRealmId: string,
  accountId: string,
  membershipId: string,
): Promise<ActiveRealmMembershipContext> {
  const parameters = [entryRealmId, accountId, membershipId];
  const resolver = await database.query<{ available: boolean }>(
    `select to_regprocedure('identity.resolve_active_membership_context(text,text,text)') is not null available`,
  );
  const result = resolver.rows[0]?.available === false
    ? await database.query<Record<string, unknown>>(`select $1::text entry_realm_id,account.realm_id current_realm_id,
      account.id account_id,membership.id active_membership_id,node.line_id,node.id node_id,
      relation.parent_node_id,relation.signed_level,node.sovereignty_tier,node.node_profile,node.mall_id,
      relation.host_sovereign_node_id,relation.relation_version::integer,
      to_char(relation.effective_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') effective_at,
      membership.access_version,node.status
      from identity.account account
      join access.membership membership on membership.account_id=account.id and membership.realm_id=account.realm_id
      join organization.node node on node.realm_id=account.realm_id
      join organization.noderelation relation on relation.line_id=node.line_id and relation.node_id=node.id
        and relation.superseded_at is null
      where account.id=$2 and membership.id=$3 and account.realm_id=$1
        and account.status='active' and membership.status='active' and node.status='active'`, parameters)
    : await database.query<Record<string, unknown>>(
      'select * from identity.resolve_active_membership_context($1,$2,$3)', parameters,
    );
  const found = result.rows[0];
  if (!found || result.rows.length !== 1) throw new Error('MEMBERSHIP_REALM_BINDING_FAILED');
  return parseActiveRealmMembershipContext(found);
}

export async function resolveRealmNode(database: OperationDatabase, hostHeader: string | undefined): Promise<RealmNodeContext> {
  const entryHost = identityEntryHost(hostHeader);
  const result = await database.query<{ realm_id: string; node_id: string }>(
    `select realm.id realm_id,realm.node_id from identity.realmentry entry
      join identity.realm realm on realm.id=entry.realm_id
      where entry.host=$1 and entry.status='active' and realm.status='active'`,
    [entryHost]
  );
  const found = result.rows[0];
  if (!found) throw new Error('AUTH_REALM_ENTRY_INVALID');
  return Object.freeze({ realmId: found.realm_id, nodeId: found.node_id, entryHost });
}

export async function resolveRealmContext(
  database: OperationDatabase,
  hostHeader: string | undefined,
  target: AuthTarget,
  application?: string,
): Promise<IdentityRealmContext> {
  const node = await resolveRealmNode(database, hostHeader);
  const result = await database.query<{
    surface: 'admin' | 'consumer';
    membership_client: IdentityRealmContext['membershipClient'];
    membership_organization_id: string;
    application_slug: string | null;
  }>(`select surface,membership_client,membership_organization_id,application_slug
      from identity.realmtarget where realm_id=$1 and target=$2`, [node.realmId, target]);
  const found = result.rows[0];
  if (!found || (found.application_slug ?? undefined) !== application) throw new Error('AUTH_REALM_MISMATCH');
  return Object.freeze({
    realmId: node.realmId,
    nodeId: node.nodeId,
    entryHost: node.entryHost,
    surface: found.surface,
    target,
    membershipClient: found.membership_client,
    membershipOrganizationId: found.membership_organization_id,
    ...(found.application_slug === null ? {} : { application: found.application_slug }),
  });
}

export async function resolveRealmApplication(database: OperationDatabase, realmId: string,
  application: string): Promise<IdentityRealmContext> {
  const result = await database.query<{
    node_id: string;
    entry_host: string;
    target: AuthTarget;
    surface: 'admin' | 'consumer';
    membership_client: IdentityRealmContext['membershipClient'];
    membership_organization_id: string;
    application_slug: string;
  }>(`select realm.node_id,min(entry.host) entry_host,target.target,target.surface,target.membership_client,
      target.membership_organization_id,target.application_slug
      from identity.realmtarget target join identity.realm realm on realm.id=target.realm_id and realm.status='active'
      join identity.realmentry entry on entry.realm_id=realm.id and entry.kind='api' and entry.status='active'
      where target.realm_id=$1 and target.application_slug=$2
      group by realm.node_id,target.target,target.surface,target.membership_client,
        target.membership_organization_id,target.application_slug`, [realmId, application]);
  const found = result.rows[0];
  if (!found || result.rows.length !== 1 || found.surface !== 'consumer') throw new Error('AUTH_REALM_MISMATCH');
  return Object.freeze({ realmId, nodeId: found.node_id, entryHost: found.entry_host, target: found.target,
    surface: found.surface, membershipClient: found.membership_client,
    membershipOrganizationId: found.membership_organization_id, application: found.application_slug });
}

export async function currentRealmAccount(
  database: OperationDatabase,
  membershipId: string,
  principalId: string,
): Promise<RealmAccountContext> {
  const result = await database.query<{ account_id: string; realm_id: string; principal_id: string; credential_version: number }>(
    `select account.id account_id,account.realm_id,account.legacy_principal_id principal_id,account.credential_version
      from access.membership membership join identity.account account on account.id=membership.account_id and account.realm_id=membership.realm_id
      where membership.id=$1 and account.legacy_principal_id=$2 and membership.status='active' and account.status='active'`,
    [membershipId, principalId]
  );
  const found = result.rows[0];
  if (!found?.principal_id) reject(403, 'REALM_ACCOUNT_INACTIVE');
  return Object.freeze({ accountId: found.account_id, realmId: found.realm_id,
    principalId: found.principal_id, credentialVersion: found.credential_version });
}
