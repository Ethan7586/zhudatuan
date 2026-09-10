import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { stringify } from 'yaml';
import { repositoryRoot } from '../lib/RepositoryRoot.mjs';

const root = repositoryRoot;
const directory = join(root, 'database', 'migrations');
const finalized = 'database/migrations/20260904065000_finalize_constraints.sql';
const files = (await readdir(directory)).filter((name) => name >= '20260821011000_create_domain_schemas.sql' && name.endsWith('.sql')).sort();
const droppedTables = new Set(['runtime.distributorcontactstage', 'runtime.partneraddressstage', 'runtime.vouchersecretstage', 'runtime.wechatidentitystage']);
const objects = [];
const seen = new Set();
const partitions = new Map();
const postDefaultTables = new Set();
const removedDefaultPolicies = new Set();
const removedJobPolicies = new Set();
const removedProviderPolicies = new Set();
const revokedTableGrants = new Set();
const legacyRoles = new Set(['zhudatuanidentityapi', 'zhudatuanidentityjob', 'zhudatuanbootstrap', 'zhudatuanwebapi', 'zhudatuanpurchaseapi', 'zhudatuansandboxbootstrap']);
const schemaOwners = new Map([
  ['invoice', 'finance'],
  ['ordering', 'order'],
]);

function add(id, kind, source, extra = {}, replace = false) {
  const key = `${kind}:${id}`;
  if (seen.has(key)) {
    if (replace) {
      const index = objects.findIndex((item) => item.id === id && item.kind === kind);
      if (index >= 0) objects[index] = { ...objects[index], source: `database/migrations/${source}`, ...extra };
    }
    return;
  }
  seen.add(key);
  objects.push({ id, kind, owner: ownerOf(id, kind), source: `database/migrations/${source}`, ...extra });
}

function remove(id, kind) {
  const key = `${kind}:${id}`;
  if (!seen.delete(key)) return;
  const index = objects.findIndex((item) => item.id === id && item.kind === kind);
  if (index >= 0) objects.splice(index, 1);
}

function removeSchema(schema) {
  for (const item of [...objects]) {
    const namespaced = item.id === schema || item.id.startsWith(`${schema}.`);
    const target = typeof item.target === 'string' && (item.target === schema || item.target.startsWith(`${schema}.`));
    if (namespaced || target) remove(item.id, item.kind);
  }
}

function removeTable(id) {
  remove(id, 'table');
  postDefaultTables.delete(id);
  removedDefaultPolicies.delete(id);
  removedJobPolicies.delete(id);
  for (const item of [...objects]) {
    const dependency = (item.kind === 'policy' || item.kind === 'trigger') && item.id.startsWith(`${id}.`);
    const grant = item.kind === 'grant' && item.objectType === 'table' && item.target === id;
    if (dependency || grant) remove(item.id, item.kind);
  }
}

function ownerOf(id, kind) {
  const schema = kind === 'grant' ? id.split(':')[2]?.split('.')[0] : id.split('.')[0];
  if (schema === undefined) return 'database';
  return `shop${schemaOwners.get(schema) ?? schema}owner`;
}

function operationalOwner(schema) {
  return schemaOwners.get(schema) ?? schema;
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

function escaped(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function grantedLater(sql, offset, target, role, privilege) {
  const pattern = new RegExp(`grant\\s+([a-z,\\s]+?)\\s+on\\s+${escaped(target)}\\s+to\\s+([a-z0-9_,\\s]+);`, 'gi');
  for (const grant of sql.slice(offset).matchAll(pattern)) {
    const privileges = grant[1].split(',').map((value) => value.trim().toLowerCase());
    const roles = grant[2].split(',').map((value) => value.trim());
    if (roles.includes(role) && (privileges.includes(privilege) || privileges.includes('all') || privileges.includes('all privileges'))) return true;
  }
  return false;
}

const callerMap = {
  'identity.resolve_session': ['services/commerce/src/platform/security/PgAuthorizationResolver.ts'],
  'identity.resolve_preauth': ['services/commerce/src/modules/identity/infrastructure/security/PgPreauthResolver.ts'],
  'identity.navigation_identity': ['services/commerce/src/modules/identity/infrastructure/persistence/PgMembershipContext.ts'],
  'access.authorization_snapshot': ['services/commerce/src/modules/access/infrastructure/persistence/PgAuthorizationRepository.ts', 'services/commerce/src/platform/security/PgAuthorizationResolver.ts'],
  'notification.visible_notifications': ['services/commerce/src/modules/notification/infrastructure/persistence/PgNotificationRepository.ts'],
  'access.consume_action_proof': ['services/commerce/src/modules/access/infrastructure/persistence/PgMakerCheckerGuard.ts'],
  'access.navigation_access': ['services/commerce/src/modules/access/infrastructure/persistence/PgAuthorizationRepository.ts'],
  'capability.navigation_capabilities': ['services/commerce/src/modules/capability/infrastructure/persistence/PgNavigationCapability.ts'],
  'organization.navigation_scopes': ['services/commerce/src/modules/organization/infrastructure/persistence/PgNavigationOrganization.ts'],
  'runtime.accept_inbox': ['services/commerce/src/platform/database/PgInbox.ts'],
  'runtime.claim_job': ['services/commerce/src/modules/runtime/infrastructure/persistence/PgJobQueue.ts'],
  'channel.authorize_supplier_return': ['extensions/channel/supplier/integration/Local.ts'],
  'channel.pull_supplier_catalog': ['extensions/channel/supplier/integration/Local.ts'],
  'channel.pull_supplier_stock': ['extensions/channel/supplier/integration/Local.ts'],
  'channel.submit_supplier_order': ['extensions/channel/supplier/integration/Local.ts'],
  'channel.cancel_supplier_order': ['extensions/channel/supplier/integration/Local.ts'],
  'channel.pull_supplier_tracking': ['extensions/channel/supplier/integration/Local.ts'],
  'channel.submit_supplier_refund': ['extensions/channel/supplier/integration/Local.ts'],
  'channel.build_supplier_statement': ['extensions/channel/supplier/integration/Local.ts'],
  'channel.supplier_enabled': ['extensions/channel/supplier/integration/Local.ts'],
  'experience.resolve_storefront_entry': ['services/commerce/src/modules/experience/infrastructure/persistence/PgEntryRepository.ts'],
  'extension.enabled_installations': ['services/commerce/src/modules/extension/infrastructure/persistence/PgExtensionRuntimeStore.ts'],
  'extension.load_installation': ['services/commerce/src/modules/extension/infrastructure/persistence/PgExtensionRuntimeStore.ts'],
  'reporting.cockpit': ['services/commerce/src/modules/reporting/infrastructure/persistence/PgReportRepository.ts'],
  'support.resolve_sla': ['services/commerce/src/modules/support/infrastructure/persistence/PgSupportConfigRepository.ts'],
  'ordering.payment_webhook_scope': ['services/commerce/src/modules/order/infrastructure/persistence/PgOrderReadPort.ts'],
};

for (const file of files) {
  const sql = await readFile(join(directory, file), 'utf8');
  for (const match of sql.matchAll(/create schema if not exists\s+([a-z][a-z0-9_]*)/gi)) add(match[1], 'schema', file);
  for (const match of sql.matchAll(/drop schema(?:\s+if exists)?\s+([a-z][a-z0-9_]*)/gi)) removeSchema(match[1]);
  const tableStatements = [
    ...[...sql.matchAll(/create table\s+([a-z][a-z0-9_]*)\.([a-z][a-z0-9_]*)(?:\s*\(|\s+partition\s+of)/gi)].map((match) => ({ index: match.index, action: 'create', schema: match[1], name: match[2] })),
    ...[...sql.matchAll(/drop table(?:\s+if exists)?\s+([a-z][a-z0-9_]*)\.([a-z][a-z0-9_]*)/gi)].map((match) => ({ index: match.index, action: 'drop', schema: match[1], name: match[2] })),
    ...[...sql.matchAll(/alter table\s+([a-z][a-z0-9_]*)\.([a-z][a-z0-9_]*)\s+rename to\s+([a-z][a-z0-9_]*)/gi)].map((match) => ({ index: match.index, action: 'rename', schema: match[1], name: match[2], nextSchema: match[1], nextName: match[3] })),
    ...[...sql.matchAll(/alter table\s+([a-z][a-z0-9_]*)\.([a-z][a-z0-9_]*)\s+set schema\s+([a-z][a-z0-9_]*)/gi)].map((match) => ({ index: match.index, action: 'move', schema: match[1], name: match[2], nextSchema: match[3], nextName: match[2] })),
  ].sort((left, right) => left.index - right.index);
  for (const statement of tableStatements) {
    const prior = `${statement.schema}.${statement.name}`;
    if (statement.action === 'create') {
      if (!droppedTables.has(prior)) {
        add(prior, 'table', file, { rls: true });
        if (file > '20260821030000_revoke_public_access.sql') postDefaultTables.add(prior);
      }
      continue;
    }
    if (statement.action === 'drop') {
      removeTable(prior);
      continue;
    }
    const next = `${statement.nextSchema}.${statement.nextName}`;
    remove(prior, 'table');
    add(next, 'table', file, { rls: true });
    if (postDefaultTables.delete(prior)) postDefaultTables.add(next);
    if (removedDefaultPolicies.delete(prior)) removedDefaultPolicies.add(next);
    if (removedJobPolicies.delete(prior)) removedJobPolicies.add(next);
    for (const policy of objects.filter((item) => item.kind === 'policy' && item.id.startsWith(`${prior}.`))) {
      const name = policy.id.slice(prior.length + 1);
      remove(policy.id, 'policy');
      add(`${next}.${name}`, 'policy', policy.source.split('/').at(-1));
    }
    for (const trigger of objects.filter((item) => item.kind === 'trigger' && item.id.startsWith(`${prior}.`))) {
      const name = trigger.id.slice(prior.length + 1);
      remove(trigger.id, 'trigger');
      add(`${next}.${name}`, 'trigger', trigger.source.split('/').at(-1), { operationalOwner: operationalOwner(statement.nextSchema) });
    }
    for (const grant of objects.filter((item) => item.kind === 'grant' && item.objectType === 'table' && item.target === prior)) {
      remove(grant.id, 'grant');
      const id = `${grant.role}:table:${next}:${grant.privilege}`;
      add(id, 'grant', grant.source.split('/').at(-1), { role: grant.role, objectType: 'table', target: next, privilege: grant.privilege });
    }
  }
  for (const match of sql.matchAll(/create table\s+([a-z][a-z0-9_]*)\.([a-z][a-z0-9_]*)\s+partition\s+of\s+([a-z][a-z0-9_]*)\.([a-z][a-z0-9_]*)/gi)) {
    const parent = `${match[3]}.${match[4]}`;
    const children = partitions.get(parent) ?? [];
    children.push(`${match[1]}.${match[2]}`);
    partitions.set(parent, children);
  }
  for (const match of sql.matchAll(/create(?: or replace)? view\s+([a-z][a-z0-9_]*)\.([a-z][a-z0-9_]*)/gi)) add(`${match[1]}.${match[2]}`, 'view', file);
  for (const match of sql.matchAll(/drop view(?:\s+if exists)?\s+([a-z][a-z0-9_]*)\.([a-z][a-z0-9_]*)/gi)) remove(`${match[1]}.${match[2]}`, 'view');
  const functionStatements = [
    ...[...sql.matchAll(/create(?: or replace)? function\s+([a-z][a-z0-9_]*)\.([a-z][a-z0-9_]*)\s*\(([^)]*)\)/gi)].map((match) => ({ index: match.index, action: 'create', schema: match[1], name: match[2], arity: splitTopLevel(match[3]).length })),
    ...[...sql.matchAll(/drop function(?:\s+if exists)?\s+([a-z][a-z0-9_]*)\.([a-z][a-z0-9_]*)\s*\(([^)]*)\)/gi)].map((match) => ({ index: match.index, action: 'drop', schema: match[1], name: match[2], arity: splitTopLevel(match[3]).length })),
  ].sort((left, right) => left.index - right.index);
  for (const statement of functionStatements) {
    const id = `${statement.schema}.${statement.name}`;
    if (statement.action === 'drop') {
      const retainedOverload = functionStatements.some((candidate) => candidate.action === 'create' && candidate.schema === statement.schema && candidate.name === statement.name && candidate.arity !== statement.arity);
      if (!retainedOverload) remove(id, 'function');
      for (const grant of objects.filter((item) => item.kind === 'grant' && item.objectType === 'function' && typeof item.target === 'string' && item.target.startsWith(`${id}(`))) remove(grant.id, 'grant');
    } else {
      const callers = callerMap[id];
      add(id, 'function', file, callers ? { callers } : { operationalOwner: operationalOwner(statement.schema) }, true);
    }
  }
  for (const match of sql.matchAll(/alter function\s+([a-z][a-z0-9_]*)\.([a-z][a-z0-9_]*)\s*\(([^)]*)\)\s+rename to\s+([a-z][a-z0-9_]*)/gi)) {
    const prior = `${match[1]}.${match[2]}`;
    const next = `${match[1]}.${match[4]}`;
    const signature = match[3].replace(/\s+/g, '');
    remove(prior, 'function');
    const callers = callerMap[next];
    add(next, 'function', file, callers ? { callers } : { operationalOwner: operationalOwner(match[1]) });
    for (const grant of objects.filter((item) => item.kind === 'grant' && item.objectType === 'function' && item.target === `${prior}(${signature})`)) {
      remove(grant.id, 'grant');
      const target = `${next}(${signature})`;
      const id = `${grant.role}:function:${target}:${grant.privilege}`;
      add(id, 'grant', file, { role: grant.role, objectType: 'function', target, privilege: grant.privilege });
    }
  }
  const triggerStatements = [
    ...[...sql.matchAll(/create(?: constraint)? trigger\s+([a-z][a-z0-9_]*)[\s\S]*?\son\s+([a-z][a-z0-9_]*)\.([a-z][a-z0-9_]*)/gi)].map((match) => ({ index: match.index, action: 'create', name: match[1], table: `${match[2]}.${match[3]}` })),
    ...[...sql.matchAll(/drop trigger(?:\s+if exists)?\s+([a-z][a-z0-9_]*)\s+on\s+([a-z][a-z0-9_]*)\.([a-z][a-z0-9_]*)/gi)].map((match) => ({ index: match.index, action: 'drop', name: match[1], table: `${match[2]}.${match[3]}` })),
  ].sort((left, right) => left.index - right.index);
  for (const statement of triggerStatements) {
    if (statement.action === 'drop') {
      remove(`${statement.table}.${statement.name}`, 'trigger');
      continue;
    }
    add(`${statement.table}.${statement.name}`, 'trigger', file, { operationalOwner: operationalOwner(statement.table.split('.')[0]) });
    for (const child of partitions.get(statement.table) ?? []) add(`${child}.${statement.name}`, 'trigger', file, { operationalOwner: operationalOwner(child.split('.')[0]) });
  }
  const policyStatements = [
    ...[...sql.matchAll(/create policy\s+([a-z][a-z0-9_]*)\s+on\s+([a-z][a-z0-9_]*)\.([a-z][a-z0-9_]*)/gi)].map((match) => ({ index: match.index, action: 'create', name: match[1], table: `${match[2]}.${match[3]}` })),
    ...[...sql.matchAll(/drop policy(?:\s+if exists)?\s+([a-z][a-z0-9_]*)\s+on\s+([a-z][a-z0-9_]*)\.([a-z][a-z0-9_]*)/gi)].map((match) => ({ index: match.index, action: 'drop', name: match[1], table: `${match[2]}.${match[3]}` })),
  ].sort((left, right) => left.index - right.index);
  for (const statement of policyStatements) {
    if (statement.action === 'create') add(`${statement.table}.${statement.name}`, 'policy', file);
    else remove(`${statement.table}.${statement.name}`, 'policy');
    if (statement.action === 'drop' && statement.name.toLowerCase() === 'appscope') removedDefaultPolicies.add(statement.table);
    if (statement.action === 'drop' && statement.name.toLowerCase() === 'jobscope') removedJobPolicies.add(statement.table);
    if (statement.action === 'drop' && statement.name.toLowerCase() === 'providerscope') removedProviderPolicies.add(statement.table);
  }
  for (const loop of sql.matchAll(/foreach\s+target\s+in\s+array\s+array\[([^\]]+)]\s+loop([\s\S]*?)end\s+loop;/gi)) {
    const targets = [...loop[1].matchAll(/'([a-z][a-z0-9_]*)'/gi)].map((match) => match[1]);
    for (const policy of loop[2].matchAll(/create policy\s+([a-z][a-z0-9_]*)\s+on\s+([a-z][a-z0-9_]*)\.%I/gi)) {
      for (const target of targets) add(`${policy[2]}.${target}.${policy[1]}`, 'policy', file);
    }
  }
  for (const match of sql.matchAll(/^\s*grant\s+([a-z,\s]+?)\s+on\s+(schema|function)?\s*([\s\S]*?)\s+to\s+([a-z0-9_,\s]+);/gim)) {
    const privileges = match[1]
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean);
    const declaredType = (match[2] ?? 'table').toLowerCase();
    const targets = splitTopLevel(match[3]);
    const roles = match[4]
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    for (const role of roles)
      for (const target of targets)
        for (const privilege of privileges) {
          const canonical = target.replace(/\s+/g, '').replaceAll('timestamptz', 'timestampwithtimezone');
          const type = declaredType === 'table' && seen.has(`view:${canonical}`) ? 'view' : declaredType;
          add(`${role}:${type}:${canonical}:${privilege}`, 'grant', file, { role, objectType: type, target: canonical, privilege });
        }
  }
  for (const match of sql.matchAll(/^\s*revoke\s+([a-z,\s]+?)\s+on\s+([a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)(?:\s*,\s*[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*))*)\s+from\s+([a-z0-9_,\s]+);/gim)) {
    const declared = match[1]
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean);
    const privileges = declared.some((value) => value === 'all' || value === 'all privileges') ? ['select', 'insert', 'update', 'delete'] : declared;
    const targets = match[2].split(',').map((value) => value.trim());
    const roles = match[3]
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    for (const role of roles)
      for (const target of targets)
        for (const privilege of privileges) {
          if (grantedLater(sql, match.index + match[0].length, target, role, privilege)) continue;
          const id = `${role}:table:${target}:${privilege}`;
          revokedTableGrants.add(id);
          remove(id, 'grant');
        }
  }
}

for (let index = objects.length - 1; index >= 0; index -= 1) {
  const item = objects[index];
  if (item.kind === 'grant' && item.role === 'shopprovider') {
    objects.splice(index, 1);
    seen.delete(`grant:${item.id}`);
    continue;
  }
  if (item.kind === 'grant' && item.objectType === 'table' && (!item.target.includes('.') || item.target.startsWith('alltablesinschema') || item.target.startsWith('allsequencesinschema'))) {
    objects.splice(index, 1);
    seen.delete(`grant:${item.id}`);
  }
}

for (const item of [...objects]) {
  const policy = item.kind === 'policy' ? (item.id.split('.').at(-1) ?? '') : '';
  const legacyPolicy = policy.startsWith('zhudatuan');
  const legacyGrant = item.kind === 'grant' && typeof item.role === 'string' && legacyRoles.has(item.role);
  if (legacyPolicy || legacyGrant) remove(item.id, item.kind);
}

const accessRoles = ['shopapp', 'shopjob'];
const providerSchemas = new Set(['runtime', 'extension', 'channel', 'catalog', 'pricing', 'inventory', 'fulfillment', 'ordering', 'organization', 'finance', 'audit']);
for (const table of objects.filter((item) => item.kind === 'table' && providerSchemas.has(item.id.split('.')[0]))) {
  if (table.source <= 'database/migrations/20260831016000_isolate_provider_workload.sql' && !removedProviderPolicies.has(table.id)) {
    add(`${table.id}.providerscope`, 'policy', '20260831016000_isolate_provider_workload.sql');
  }
}
for (const schema of objects.filter((item) => item.kind === 'schema')) {
  for (const role of accessRoles) add(`${role}:schema:${schema.id}:usage`, 'grant', '20260821030000_revoke_public_access.sql', { role, objectType: 'schema', target: schema.id, privilege: 'usage' });
}
for (const table of objects.filter((item) => item.kind === 'table')) {
  if (postDefaultTables.has(table.id)) continue;
  for (const role of accessRoles)
    for (const privilege of ['select', 'insert', 'update', 'delete']) {
      const id = `${role}:table:${table.id}:${privilege}`;
      if (revokedTableGrants.has(id)) continue;
      add(id, 'grant', '20260821030000_revoke_public_access.sql', { role, objectType: 'table', target: table.id, privilege });
    }
}

for (const table of objects.filter((item) => item.kind === 'table')) {
  if (table.source > finalized) continue;
  add(`${table.id}.moduleowner`, 'policy', '20260904065000_finalize_constraints.sql');
  add(`${table.id}.moduleread`, 'policy', '20260904065000_finalize_constraints.sql');
  add(`${table.id}.modulereader`, 'policy', '20260904065000_finalize_constraints.sql');
  add(`${table.id}.modulewriter`, 'policy', '20260904065000_finalize_constraints.sql');
  add(`${table.id}.migrationaccess`, 'policy', '20260904065000_finalize_constraints.sql');
  if (!postDefaultTables.has(table.id) && !removedDefaultPolicies.has(table.id)) {
    add(`${table.id}.appscope`, 'policy', '20260821030000_revoke_public_access.sql');
  }
  if (!postDefaultTables.has(table.id) && !removedJobPolicies.has(table.id)) add(`${table.id}.jobscope`, 'policy', '20260821030000_revoke_public_access.sql');
}

objects.sort((left, right) => left.kind.localeCompare(right.kind) || left.id.localeCompare(right.id));
await writeFile(join(root, 'database', 'contracts', 'objects.yml'), stringify({ version: 1, objects }, { lineWidth: 0 }), 'utf8');
