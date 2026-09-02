import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { stringify } from 'yaml';
import { repositoryRoot } from '../lib/RepositoryRoot.mjs';

const root = repositoryRoot;
const directory = join(root, 'database', 'supabase', 'migrations');
const files = (await readdir(directory))
  .filter((name) => name.endsWith('.sql') && name >= '20260821011000_create_domain_schemas.sql')
  .sort();
const droppedTables = new Set([
  'runtime.distributorcontactstage',
  'runtime.partneraddressstage',
  'runtime.vouchersecretstage',
  'runtime.wechatidentitystage',
]);
const objects = [];
const seen = new Set();
const partitions = new Map();
const postDefaultTables = new Set();
const removedDefaultPolicies = new Set();
const removedJobPolicies = new Set();
const revokedTableGrants = new Set();
const revokedSchemaTableGrants = new Set();

function add(id, kind, source, extra = {}) {
  const key = `${kind}:${id}`;
  if (seen.has(key)) return;
  seen.add(key);
  objects.push({ id, kind, owner: ownerOf(id, kind), source: `database/supabase/migrations/${source}`, ...extra });
}

function remove(id, kind) {
  const key = `${kind}:${id}`;
  if (!seen.delete(key)) return;
  const index = objects.findIndex((item) => item.id === id && item.kind === kind);
  if (index >= 0) objects.splice(index, 1);
}

function ownerOf(id, kind) {
  if (kind === 'grant') return id.split(':')[2]?.split('.')[0] ?? 'database';
  return id.split('.')[0];
}

function splitTopLevel(value) {
  const values = [];
  let start = 0;
  let depth = 0;
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] === '(') depth += 1;
    if (value[index] === ')') depth -= 1;
    if (value[index] === ',' && depth === 0) {
      values.push(value.slice(start, index).trim());
      start = index + 1;
    }
  }
  values.push(value.slice(start).trim());
  return values.filter(Boolean);
}

const callerMap = {
  'identity.resolve_session': ['services/commerce/src/foundation/security/PgAccessResolvers.ts'],
  'access.resolve_membership': ['services/commerce/src/foundation/security/PgAccessResolvers.ts'],
  'access.resolve_scope': ['services/commerce/src/foundation/security/PgAccessResolvers.ts'],
  'access.membership_version': ['services/commerce/src/foundation/security/PgAccessResolvers.ts'],
  'capability.membership_operations': ['services/commerce/src/foundation/security/PgAccessResolvers.ts'],
  'access.purchase_checkout_context': ['services/commerce/src/modules/purchase/PurchaseCheckoutContext.ts'],
  'access.purchase_order_quote': ['services/commerce/src/modules/purchase/PurchaseOrderQuoteStore.ts'],
  'access.purchase_payment_intent_context': ['services/commerce/src/modules/purchase/PurchasePaymentIntentContext.ts'],
  'access.purchase_enqueue_payment_query': ['services/commerce/src/modules/purchase/PurchasePaymentRecoveryQueue.ts'],
  'runtime.accept_inbox': ['services/commerce/src/foundation/infrastructure/InboxStore.ts'],
  'runtime.claim_job': ['services/commerce/src/foundation/application/JobRunner.ts'],
  'channel.pull_private_catalog': ['services/commerce/src/modules/channel/infrastructure/adapter/PgPrivateProvider.ts'],
  'channel.pull_private_stock': ['services/commerce/src/modules/channel/infrastructure/adapter/PgPrivateProvider.ts'],
  'channel.submit_private_order': ['services/commerce/src/modules/channel/infrastructure/adapter/PgPrivateProvider.ts'],
  'channel.cancel_private_order': ['services/commerce/src/modules/channel/infrastructure/adapter/PgPrivateProvider.ts'],
  'channel.pull_private_tracking': ['services/commerce/src/modules/channel/infrastructure/adapter/PgPrivateProvider.ts'],
  'channel.submit_private_refund': ['services/commerce/src/modules/channel/infrastructure/adapter/PgPrivateProvider.ts'],
  'channel.build_private_statement': ['services/commerce/src/modules/channel/infrastructure/adapter/PgPrivateProvider.ts'],
  'channel.private_enabled': ['services/commerce/src/modules/channel/infrastructure/adapter/PgPrivateProvider.ts'],
  'extension.enabled_installations': ['services/commerce/src/bootstrap/ProviderLoader.ts'],
  'extension.load_installation': ['services/commerce/src/bootstrap/ProviderLoader.ts'],
  'experience.read_published': ['services/commerce/src/modules/experience/ExperienceOperations.ts'],
  'payment.webhook_scope': ['services/commerce/src/modules/payment/PaymentWebhook.ts'],
  'reporting.cockpit': ['services/commerce/src/modules/reporting/infrastructure/persistence/PgReportingRepository.ts'],
};

for (const file of files) {
  const sql = await readFile(join(directory, file), 'utf8');
  for (const match of sql.matchAll(/create schema(?: if not exists)?\s+([a-z][a-z0-9]*)/gi)) add(match[1], 'schema', file);
  for (const match of sql.matchAll(/create table\s+([a-z][a-z0-9]*)\.([a-z][a-z0-9]*)(?:\s*\(|\s+partition\s+of)/gi)) {
    const id = `${match[1]}.${match[2]}`;
    if (!droppedTables.has(id)) {
      add(id, 'table', file, { rls: true });
      if (file>'20260821030000_revoke_public_access.sql') postDefaultTables.add(id);
    }
  }
  for (const match of sql.matchAll(/create table\s+([a-z][a-z0-9]*)\.([a-z][a-z0-9]*)\s+partition\s+of\s+([a-z][a-z0-9]*)\.([a-z][a-z0-9]*)/gi)) {
    const parent = `${match[3]}.${match[4]}`; const children = partitions.get(parent) ?? [];
    children.push(`${match[1]}.${match[2]}`); partitions.set(parent,children);
  }
  for (const match of sql.matchAll(/drop table(?:\s+if exists)?\s+([a-z][a-z0-9]*)\.([a-z][a-z0-9]*)/gi)) remove(`${match[1]}.${match[2]}`, 'table');
  for (const match of sql.matchAll(/alter table\s+([a-z][a-z0-9]*)\.([a-z][a-z0-9]*)\s+rename to\s+([a-z][a-z0-9]*)/gi)) {
    const prior = `${match[1]}.${match[2]}`; const next = `${match[1]}.${match[3]}`;
    remove(prior, 'table'); add(next, 'table', file, { rls: true });
    if (postDefaultTables.delete(prior)) postDefaultTables.add(next);
    if (removedDefaultPolicies.delete(prior)) removedDefaultPolicies.add(next);
  }
  for (const match of sql.matchAll(/alter table\s+([a-z][a-z0-9]*)\.([a-z][a-z0-9]*)\s+set schema\s+([a-z][a-z0-9]*)/gi)) {
    const prior = `${match[1]}.${match[2]}`; const next = `${match[3]}.${match[2]}`;
    remove(prior, 'table'); add(next, 'table', file, { rls: true });
    if (postDefaultTables.delete(prior)) postDefaultTables.add(next);
    if (removedDefaultPolicies.delete(prior)) removedDefaultPolicies.add(next);
    if (removedJobPolicies.delete(prior)) removedJobPolicies.add(next);
    for (const policy of objects.filter((item) => item.kind === 'policy' && item.id.startsWith(`${prior}.`))) {
      const name = policy.id.slice(prior.length + 1); remove(policy.id, 'policy'); add(`${next}.${name}`, 'policy', policy.source.split('/').at(-1));
    }
    for (const grant of objects.filter((item) => item.kind === 'grant' && item.objectType === 'table' && item.target === prior)) {
      remove(grant.id, 'grant');
      const id = `${grant.role}:table:${next}:${grant.privilege}`;
      add(id, 'grant', grant.source.split('/').at(-1), { role: grant.role, objectType: 'table', target: next, privilege: grant.privilege });
    }
  }
  for (const match of sql.matchAll(/create(?: or replace)? view\s+([a-z][a-z0-9]*)\.([a-z][a-z0-9]*)/gi)) add(`${match[1]}.${match[2]}`, 'view', file);
  for (const match of sql.matchAll(/drop view(?:\s+if exists)?\s+([a-z][a-z0-9]*)\.([a-z][a-z0-9]*)/gi)) remove(`${match[1]}.${match[2]}`, 'view');
  for (const match of sql.matchAll(/create(?: or replace)? function\s+([a-z][a-z0-9]*)\.([a-z][a-z0-9_]*)\s*\(/gi)) {
    const id = `${match[1]}.${match[2]}`;
    const callers = callerMap[id];
    add(id, 'function', file, callers ? { callers } : { operationalOwner: match[1] });
  }
  for (const match of sql.matchAll(/alter function\s+([a-z][a-z0-9]*)\.[a-z][a-z0-9_]*\s*\([^;]*?\)\s+rename to\s+([a-z][a-z0-9_]*)/gi)) {
    add(`${match[1]}.${match[2]}`, 'function', file, { operationalOwner: match[1] });
  }
  const triggerStatements = [
    ...[...sql.matchAll(/create(?: constraint)? trigger\s+([a-z][a-z0-9_]*)[\s\S]*?\son\s+([a-z][a-z0-9]*)\.([a-z][a-z0-9]*)/gi)]
      .map((match) => ({ index: match.index, action: 'create', name: match[1], table: `${match[2]}.${match[3]}` })),
    ...[...sql.matchAll(/drop trigger(?:\s+if exists)?\s+([a-z][a-z0-9_]*)\s+on\s+([a-z][a-z0-9]*)\.([a-z][a-z0-9]*)/gi)]
      .map((match) => ({ index: match.index, action: 'drop', name: match[1], table: `${match[2]}.${match[3]}` })),
  ].sort((left, right) => left.index - right.index);
  for (const statement of triggerStatements) {
    const id = `${statement.table}.${statement.name}`;
    if (statement.action === 'create') {
      add(id, 'trigger', file, { operationalOwner: statement.table.split('.')[0] });
      for (const child of partitions.get(statement.table) ?? []) add(`${child}.${statement.name}`, 'trigger', file,
        { operationalOwner: child.split('.')[0] });
    } else remove(id, 'trigger');
  }
  const policyStatements = [
    ...[...sql.matchAll(/create policy\s+([a-z][a-z0-9_]*)\s+on\s+([a-z][a-z0-9]*)\.([a-z][a-z0-9]*)/gi)]
      .map((match) => ({ index:match.index, action:'create', name:match[1], table:`${match[2]}.${match[3]}` })),
    ...[...sql.matchAll(/drop policy(?:\s+if exists)?\s+([a-z][a-z0-9_]*)\s+on\s+([a-z][a-z0-9]*)\.([a-z][a-z0-9]*)/gi)]
      .map((match) => ({ index:match.index, action:'drop', name:match[1], table:`${match[2]}.${match[3]}` })),
  ].sort((left,right) => left.index-right.index);
  for (const statement of policyStatements) {
    if (statement.action==='create') add(`${statement.table}.${statement.name}`, 'policy', file);
    else remove(`${statement.table}.${statement.name}`, 'policy');
    if (statement.action==='drop' && statement.name.toLowerCase()==='appscope') removedDefaultPolicies.add(statement.table);
    if (statement.action==='drop' && statement.name.toLowerCase()==='jobscope') removedJobPolicies.add(statement.table);
  }
  const grantStatements = [
    ...[...sql.matchAll(/grant\s+([a-z,\s]+?)\s+on\s+(schema|function|table)?\s*([\s\S]*?)\s+to\s+([a-z0-9_,\s]+);/gi)]
      .map((match) => ({ index: match.index, action: 'grant', match })),
    ...[...sql.matchAll(/revoke\s+([a-z,\s]+?)\s+on\s+(?:table\s+)?([a-z][a-z0-9]*(?:\.[a-z][a-z0-9]*)(?:\s*,\s*[a-z][a-z0-9]*(?:\.[a-z][a-z0-9]*))*)\s+from\s+([a-z0-9_,\s]+);/gi)]
      .map((match) => ({ index: match.index, action: 'revoke-table', match })),
    ...[...sql.matchAll(/revoke\s+([a-z,\s]+?)\s+on\s+all\s+tables\s+in\s+schema\s+([a-z][a-z0-9]*)\s+from\s+([a-z0-9_,\s]+);/gi)]
      .map((match) => ({ index: match.index, action: 'revoke-schema', match })),
  ].sort((left, right) => left.index - right.index);
  for (const statement of grantStatements) {
    const { match } = statement;
    if (statement.action === 'grant') {
      const privileges = match[1].split(',').map((value) => value.trim().toLowerCase()).filter(Boolean);
      const declaredType = (match[2] ?? 'table').toLowerCase();
      const targets = splitTopLevel(match[3]);
      const roles = match[4].split(',').map((value) => value.trim()).filter(Boolean);
      for (const role of roles) for (const target of targets) for (const privilege of privileges) {
        const canonical = target.replace(/\s+/g, '').replaceAll('timestamptz','timestampwithtimezone');
        const type = declaredType === 'table' && seen.has(`view:${canonical}`) ? 'view' : declaredType;
        const id = `${role}:${type}:${canonical}:${privilege}`;
        revokedTableGrants.delete(id);
        add(id, 'grant', file, { role, objectType: type, target: canonical, privilege });
      }
      continue;
    }
    const declared=match[1].split(',').map((value)=>value.trim().toLowerCase()).filter(Boolean);
    const privileges=declared.includes('all') ? ['select','insert','update','delete'] : declared;
    if (statement.action === 'revoke-table') {
      const targets=match[2].split(',').map((value)=>value.trim()); const roles=match[3].split(',').map((value)=>value.trim()).filter(Boolean);
      for (const role of roles) for (const target of targets) for (const privilege of privileges) {
        const id=`${role}:table:${target}:${privilege}`; revokedTableGrants.add(id); remove(id,'grant');
      }
      continue;
    }
    const schema=match[2]; const roles=match[3].split(',').map((value)=>value.trim()).filter(Boolean);
    for (const role of roles) for (const privilege of privileges) {
      revokedSchemaTableGrants.add(`${role}:${schema}:${privilege}`);
      for (const item of [...objects]) {
        if (item.kind==='grant' && item.objectType==='table' && item.role===role
          && item.privilege===privilege && item.target.startsWith(`${schema}.`)) remove(item.id,'grant');
      }
    }
  }
}

for (let index = objects.length - 1; index >= 0; index -= 1) {
  const item = objects[index];
  if (item.kind === 'grant' && item.objectType === 'table' && (!item.target.includes('.') || item.target.startsWith('alltablesinschema') || item.target.startsWith('allsequencesinschema'))) {
    objects.splice(index, 1);
    seen.delete(`grant:${item.id}`);
  }
}

const accessRoles = ['shopapp', 'shopjob'];
for (const schema of objects.filter((item) => item.kind === 'schema')) {
  for (const role of accessRoles) add(`${role}:schema:${schema.id}:usage`, 'grant', '20260821030000_revoke_public_access.sql',
    { role, objectType: 'schema', target: schema.id, privilege: 'usage' });
}
for (const table of objects.filter((item) => item.kind === 'table')) {
  if (postDefaultTables.has(table.id)) continue;
  for (const role of accessRoles) for (const privilege of ['select', 'insert', 'update', 'delete']) {
    const id=`${role}:table:${table.id}:${privilege}`;
    if (revokedTableGrants.has(id) || revokedSchemaTableGrants.has(`${role}:${table.id.split('.')[0]}:${privilege}`)) continue;
    add(id, 'grant', '20260821030000_revoke_public_access.sql',
      { role, objectType: 'table', target: table.id, privilege });
  }
}

for (const table of objects.filter((item) => item.kind === 'table')) {
  if (!postDefaultTables.has(table.id) && !removedDefaultPolicies.has(table.id)) {
    add(`${table.id}.appscope`, 'policy', '20260821030000_revoke_public_access.sql');
  }
  if (!postDefaultTables.has(table.id) && !removedJobPolicies.has(table.id)) add(`${table.id}.jobscope`, 'policy', '20260821030000_revoke_public_access.sql');
}

for (const table of objects.filter((item) => item.kind === 'table' && item.id.startsWith('referral.'))) {
  add(`${table.id}.appscope`, 'policy', '20260829105000_create_referral_foundation.sql');
  add(`${table.id}.jobscope`, 'policy', '20260829105000_create_referral_foundation.sql');
}

// The registration baseline creates these policies from guarded PL/pgSQL
// table-name loops, so the static SQL matcher cannot discover them directly.
for (const table of [
  'access.decisionaudit', 'access.membershipoverride', 'access.permission', 'access.role', 'access.rolepermission',
  'audit.accessrecord', 'audit.record',
  'capability.capability', 'capability.entitlement', 'capability.operation',
  'identity.assurance', 'identity.authticket', 'identity.challenge', 'identity.challengesecret', 'identity.credential',
  'identity.federatedidentity', 'identity.loginattempt', 'identity.principal', 'identity.registrationpolicy',
  'identity.session', 'identity.wechatgrant', 'member.profile', 'organization.organization', 'organization.unitclosure',
  'risk.decision', 'risk.listentry', 'risk.policy', 'risk.policyversion', 'risk.signal',
  'runtime.idempotency', 'runtime.job', 'runtime.outbox',
]) add(`${table}.zhudatuanidentityapi`, 'policy', '20260828170000_zhudatuan_registration_baseline.sql');

objects.sort((left, right) => left.kind.localeCompare(right.kind) || left.id.localeCompare(right.id));
await writeFile(join(root, 'database', 'contracts', 'objects.yml'), stringify({ version: 1, objects }, { lineWidth: 0 }), 'utf8');
