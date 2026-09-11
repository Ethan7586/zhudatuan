import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { stringify } from 'yaml';
import { repositoryRoot } from '../lib/RepositoryRoot.mjs';

const root = repositoryRoot;
const directory = join(root, '02_platform_pingtai', 'database', 'supabase', 'migrations');
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
const postDefaultSchemas = new Set();
const postDefaultTables = new Set();
const removedDefaultPolicies = new Set();
const removedJobPolicies = new Set();
const revokedTableGrants = new Set();

function add(id, kind, source, extra = {}) {
  const key = `${kind}:${id}`;
  if (seen.has(key)) return;
  seen.add(key);
  objects.push({ id, kind, owner: ownerOf(id, kind), source: `02_platform_pingtai/database/supabase/migrations/${source}`, ...extra });
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
  'identity.resolve_session': ['01_core_hexin/services/commerce/src/foundation/security/PgAccessResolvers.ts'],
  'access.resolve_membership': ['01_core_hexin/services/commerce/src/foundation/security/PgAccessResolvers.ts'],
  'access.resolve_scope': ['01_core_hexin/services/commerce/src/foundation/security/PgAccessResolvers.ts'],
  'access.membership_version': ['01_core_hexin/services/commerce/src/foundation/security/PgAccessResolvers.ts'],
  'capability.membership_operations': ['01_core_hexin/services/commerce/src/foundation/security/PgAccessResolvers.ts'],
  'access.purchase_checkout_context': ['01_core_hexin/services/commerce/src/modules/purchase/PurchaseCheckoutContext.ts'],
  'access.purchase_order_quote': ['01_core_hexin/services/commerce/src/modules/purchase/PurchaseOrderQuoteStore.ts'],
  'access.purchase_payment_intent_context': ['01_core_hexin/services/commerce/src/modules/purchase/PurchasePaymentIntentContext.ts'],
  'access.purchase_enqueue_payment_query': ['01_core_hexin/services/commerce/src/modules/purchase/PurchasePaymentRecoveryQueue.ts'],
  'runtime.accept_inbox': ['01_core_hexin/services/commerce/src/foundation/infrastructure/InboxStore.ts'],
  'runtime.claim_job': ['01_core_hexin/services/commerce/src/foundation/application/JobRunner.ts'],
  'channel.pull_private_catalog': ['01_core_hexin/services/commerce/src/modules/channel/infrastructure/adapter/PgPrivateProvider.ts'],
  'channel.pull_private_stock': ['01_core_hexin/services/commerce/src/modules/channel/infrastructure/adapter/PgPrivateProvider.ts'],
  'channel.submit_private_order': ['01_core_hexin/services/commerce/src/modules/channel/infrastructure/adapter/PgPrivateProvider.ts'],
  'channel.cancel_private_order': ['01_core_hexin/services/commerce/src/modules/channel/infrastructure/adapter/PgPrivateProvider.ts'],
  'channel.pull_private_tracking': ['01_core_hexin/services/commerce/src/modules/channel/infrastructure/adapter/PgPrivateProvider.ts'],
  'channel.submit_private_refund': ['01_core_hexin/services/commerce/src/modules/channel/infrastructure/adapter/PgPrivateProvider.ts'],
  'channel.build_private_statement': ['01_core_hexin/services/commerce/src/modules/channel/infrastructure/adapter/PgPrivateProvider.ts'],
  'channel.private_enabled': ['01_core_hexin/services/commerce/src/modules/channel/infrastructure/adapter/PgPrivateProvider.ts'],
  'extension.enabled_installations': ['01_core_hexin/services/commerce/src/bootstrap/ProviderLoader.ts'],
  'extension.load_installation': ['01_core_hexin/services/commerce/src/bootstrap/ProviderLoader.ts'],
  'experience.read_published': ['01_core_hexin/services/commerce/src/modules/experience/ExperienceOperations.ts'],
  'payment.webhook_scope': ['01_core_hexin/services/commerce/src/modules/payment_zhifu/05_interface_jieru/http/PaymentWebhook.ts'],
  'reporting.cockpit': ['01_core_hexin/services/commerce/src/modules/reporting/infrastructure/persistence/PgReportingRepository.ts'],
};

for (const file of files) {
  const sql = await readFile(join(directory, file), 'utf8');
  for (const match of sql.matchAll(/create schema(?: if not exists)?\s+([a-z][a-z0-9]*)/gi)) {
    add(match[1], 'schema', file);
    if (file>'20260821030000_revoke_public_access.sql') postDefaultSchemas.add(match[1]);
  }
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
  for (const match of sql.matchAll(/alter function\s+([a-z][a-z0-9]*)\.([a-z][a-z0-9_]*)\s*\([^;]*?\)\s+rename to\s+([a-z][a-z0-9_]*)/gi)) {
    const prior = `${match[1]}.${match[2]}`;
    const next = `${match[1]}.${match[3]}`;
    const remainder = sql.slice((match.index ?? 0) + match[0].length);
    const recreated = new RegExp(`create(?: or replace)? function\\s+${match[1]}\\.${match[2]}\\s*\\(`, 'i').test(remainder);
    if (!recreated) remove(prior, 'function');
    const callers = callerMap[next];
    add(next, 'function', file, callers ? { callers } : { operationalOwner: match[1] });
  }
  const triggerStatements = [
    ...[...sql.matchAll(/create(?: constraint)? trigger\s+([a-z][a-z0-9_]*)[\s\S]*?\son\s+([a-z][a-z0-9]*)\.([a-z][a-z0-9]*)/gi)]
      .map((match) => ({ index:match.index, action:'create', name:match[1], table:`${match[2]}.${match[3]}` })),
    ...[...sql.matchAll(/drop trigger(?: if exists)?\s+([a-z][a-z0-9_]*)\s+on\s+([a-z][a-z0-9]*)\.([a-z][a-z0-9]*)/gi)]
      .map((match) => ({ index:match.index, action:'drop', name:match[1], table:`${match[2]}.${match[3]}` })),
  ].sort((left,right) => left.index-right.index);
  for (const statement of triggerStatements) {
    const id = `${statement.table}.${statement.name}`;
    if (statement.action === 'drop') {
      remove(id, 'trigger');
      continue;
    }
    add(id, 'trigger', file, { operationalOwner: statement.table.split('.')[0] });
    for (const child of partitions.get(statement.table) ?? []) add(`${child}.${statement.name}`, 'trigger', file,
      { operationalOwner: child.split('.')[0] });
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
  for (const loop of sql.matchAll(/foreach\s+[a-z][a-z0-9_]*\s+in\s+array\s+array\[([\s\S]*?)\]\s+loop([\s\S]*?)end loop;/gi)) {
    const values = [...loop[1].matchAll(/'([^']+)'/g)].map((match) => match[1]);
    const dynamicPolicies = [...loop[2].matchAll(/(create|drop)\s+policy(?:\s+if\s+exists)?\s+([a-z][a-z0-9_]*)\s+on\s+(?:([a-z][a-z0-9]*)\.)?%I(\.%I)?/gi)];
    for (const value of values) for (const statement of dynamicPolicies) {
      const table = statement[4] ? value : `${statement[3]}.${value}`;
      if (!table.includes('.') || table.startsWith('undefined.')) continue;
      const id = `${table}.${statement[2]}`;
      if (statement[1].toLowerCase() === 'create') add(id, 'policy', file);
      else remove(id, 'policy');
      if (statement[1].toLowerCase() === 'drop' && statement[2].toLowerCase() === 'appscope') removedDefaultPolicies.add(table);
      if (statement[1].toLowerCase() === 'drop' && statement[2].toLowerCase() === 'jobscope') removedJobPolicies.add(table);
    }
  }
  const privilegeStatements = [
    ...[...sql.matchAll(/\bgrant\s+(all(?:\s+privileges)?|[a-z]+(?:\s*,\s*[a-z]+)*)\s+on\s+(?:(schema|function|table|sequence)\s+)?([^;]+?)\s+to\s+([a-z0-9_]+(?:\s*,\s*[a-z0-9_]+)*)\s*;/gi)]
      .map((match) => ({ index:match.index, action:'grant', privileges:match[1], type:match[2] ?? 'table', targets:match[3], roles:match[4] })),
    ...[...sql.matchAll(/\brevoke\s+(all(?:\s+privileges)?|[a-z]+(?:\s*,\s*[a-z]+)*)\s+on\s+(?:(schema|function|table|sequence)\s+)?([^;]+?)\s+from\s+([a-z0-9_]+(?:\s*,\s*[a-z0-9_]+)*)\s*;/gi)]
      .map((match) => ({ index:match.index, action:'revoke', privileges:match[1], type:match[2] ?? 'table', targets:match[3], roles:match[4] })),
    ...[...sql.matchAll(/\bdrop function(?:\s+if exists)?\s+([a-z][a-z0-9]*\.[a-z][a-z0-9_]*\s*\([^;]*?\))\s*;/gi)]
      .map((match) => ({ index:match.index, action:'drop-function', target:match[1] })),
  ].sort((left,right) => left.index-right.index);
  for (const statement of privilegeStatements) {
    if (statement.action === 'drop-function') {
      const target = statement.target.replace(/\s+/g, '').replaceAll('timestamptz','timestampwithtimezone');
      for (const grant of objects.filter((item) => item.kind === 'grant' && item.objectType === 'function' && item.target === target)) {
        remove(grant.id, 'grant');
      }
      continue;
    }
    const declaredType = statement.type.toLowerCase();
    if (declaredType === 'sequence') continue;
    const declaredPrivileges = statement.privileges.toLowerCase().replace(/\s+privileges$/, '').split(',').map((value) => value.trim()).filter(Boolean);
    const privileges = declaredPrivileges.includes('all')
      ? declaredType === 'schema' ? ['usage','create'] : declaredType === 'function' ? ['execute']
        : ['select','insert','update','delete','truncate','references','trigger']
      : declaredPrivileges;
    const roles = statement.roles.split(',').map((value) => value.trim()).filter(Boolean);
    const allInSchemas = /^\s*all\s+(tables|functions)\s+in\s+schema\s+(.+)\s*$/i.exec(statement.targets);
    const statementTargets = allInSchemas
      ? splitTopLevel(allInSchemas[2]).map((schema) => `all ${allInSchemas[1]} in schema ${schema}`)
      : splitTopLevel(statement.targets);
    const targets = statementTargets.flatMap((target) => {
      const canonical = target.replace(/\s+/g, '').replaceAll('timestamptz','timestampwithtimezone');
      const allTables = /^alltablesinschema([a-z][a-z0-9]*)$/.exec(canonical);
      if (allTables) return objects.filter((item) => item.kind === 'table' && item.id.startsWith(`${allTables[1]}.`))
        .map((item) => ({ type:'table', target:item.id }));
      const allFunctions = /^allfunctionsinschema([a-z][a-z0-9]*)$/.exec(canonical);
      if (allFunctions) return objects.filter((item) => item.kind === 'function' && item.id.startsWith(`${allFunctions[1]}.`))
        .map((item) => ({ type:'function', target:item.id }));
      return [{ type:declaredType === 'table' && seen.has(`view:${canonical}`) ? 'view' : declaredType, target:canonical }];
    });
    for (const role of roles) for (const target of targets) for (const privilege of privileges) {
      const id = `${role}:${target.type}:${target.target}:${privilege}`;
      if (statement.action === 'grant') add(id, 'grant', file,
        { role, objectType: target.type, target: target.target, privilege });
      else {
        if (target.type === 'table') revokedTableGrants.add(id);
        remove(id, 'grant');
      }
    }
  }
}

const contractSchemas = new Set(objects.filter((item) => item.kind === 'schema').map((item) => item.id));
for (let index = objects.length - 1; index >= 0; index -= 1) {
  const item = objects[index];
  const targetSchema = item.kind === 'grant' && item.objectType !== 'schema' ? item.target.split('.')[0] : null;
  if (item.kind === 'grant' && (
    item.objectType === 'sequence'
    || (item.objectType === 'schema' && !contractSchemas.has(item.target))
    || (targetSchema !== null && !contractSchemas.has(targetSchema))
    || (item.objectType === 'table' && (!item.target.includes('.') || item.target.startsWith('alltablesinschema') || item.target.startsWith('allsequencesinschema')))
  )) {
    objects.splice(index, 1);
    seen.delete(`grant:${item.id}`);
  }
}

const accessRoles = ['shopapp', 'shopjob'];
for (const schema of objects.filter((item) => item.kind === 'schema')) {
  if (postDefaultSchemas.has(schema.id)) continue;
  for (const role of accessRoles) add(`${role}:schema:${schema.id}:usage`, 'grant', '20260821030000_revoke_public_access.sql',
    { role, objectType: 'schema', target: schema.id, privilege: 'usage' });
}
for (const table of objects.filter((item) => item.kind === 'table')) {
  if (postDefaultTables.has(table.id)) continue;
  for (const role of accessRoles) for (const privilege of ['select', 'insert', 'update', 'delete']) {
    const id=`${role}:table:${table.id}:${privilege}`; if (revokedTableGrants.has(id)) continue;
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

objects.sort((left, right) => left.kind.localeCompare(right.kind) || left.id.localeCompare(right.id));
await writeFile(join(root, '02_platform_pingtai', 'database', 'contracts', 'objects.yml'), stringify({ version: 1, objects }, { lineWidth: 0 }), 'utf8');
