import { DomainError } from '../../foundation/domain/DomainError';
import { createHash, randomUUID } from 'node:crypto';
import { parseExperience, serializeExperience } from '@shop/contract';
import type { ModuleContext } from '../../bootstrap/ModuleRegistry';
import { AUDIT_SINK } from '../../foundation/application/AuditSink';
import { ModuleOperations, requireAccess, rowResult, type OperationDatabase } from '../../foundation/application/ModuleOperations';
import { bodyRecord, keysetResult, queryPage, textField } from '../../foundation/interface/Validation';
import { DATABASE_POOL } from '../../foundation/persistence/Pool';
import { organizationScope } from '../../foundation/security/OrganizationScope';
import { PublishPolicy } from './domain/policy/PublishPolicy';
import { ORGANIZATION_READ_PORT } from '../organization/public';
import { EXPERIENCE_CATALOG_PORT } from '../catalog/public';
import { EXPERIENCE_MARKETING_PORT } from '../marketing/public';
import { ExperienceReferences } from './application/ExperienceReferences';

export function experienceOperations(context: ModuleContext): ModuleOperations {
  const pool = context.service(DATABASE_POOL);
  const policy = new PublishPolicy();
  const organizations = context.ports.get(ORGANIZATION_READ_PORT);
  const catalog = context.ports.get(EXPERIENCE_CATALOG_PORT);
  const references = new ExperienceReferences(catalog, context.ports.get(EXPERIENCE_MARKETING_PORT));
  return new ModuleOperations('experience', pool, context.service(AUDIT_SINK), {
    'experience.applications.create': async (request, database) => {
      const access = requireAccess(request);
      const body = bodyRecord(request);
      const identity = applicationIdentity(body);
      const binding = await catalog.activeBinding(database, await organizations.activeMalls(database, access.scope.id));
      if (!binding) throw new DomainError('VALIDATION_FAILED', { field: 'mall' });
      const name = textField(body, 'name');
      await assertApplicationUnique(database, binding.mall, name, identity);
      const id = `application:${randomUUID()}`;
      const version = `version:${randomUUID()}`;
      const configuration = initialConfiguration(id, name);
      await database.query(
        `insert into experience.application(id,scope_id,code,public_slug,name,status,created_at,updated_at,version)
        values($1,$2,$3,$4,$5,'draft',clock_timestamp(),clock_timestamp(),0)`,
        [id, binding.mall, identity.code, identity.publicSlug, name]
      );
      await database.query(
        `insert into experience.version(id,application_id,sequence,schema_version,configuration,configuration_hash,validation_state,reason,created_by,created_at)
        values($1,$2,1,'2',$3::jsonb,$4,'valid',$5,$6,clock_timestamp())`,
        [version, id, configuration, createHash('sha256').update(configuration).digest('hex'), '创建商城初始化草稿', access.actor.id]
      );
      await database.query('insert into experience.binding(application_id,domain,mall_id,pool_id) values($1,$2,$3,$4)', [id, identity.publicSlug, binding.mall, binding.pool]);
      const result = await database.query('update experience.application set head_version_id=$2,version=1,updated_at=clock_timestamp() where id=$1 returning *', [id, version]);
      return rowResult(result, 201);
    },
    'experience.applications.copy': async (request, database) => {
      const access = requireAccess(request);
      const body = bodyRecord(request);
      const identity = applicationIdentity(body);
      const source = await database.query<{ scope_id: string; configuration: unknown; validation_state: 'pending' | 'valid' | 'invalid'; mall_id: string; pool_id: string }>(
        `select application.scope_id,version.configuration,version.validation_state,binding.mall_id,binding.pool_id
        from experience.application application join experience.version version on version.id=application.head_version_id
        join lateral(select mall_id,pool_id from experience.binding where application_id=application.id order by domain limit 1) binding on true
        where application.id=$1`,
        [request.input.path.applicationid!]
      );
      const original = source.rows[0];
      if (!original) throw new DomainError('RESOURCE_NOT_FOUND');
      const name = textField(body, 'name');
      await assertApplicationUnique(database, original.scope_id, name, identity);
      const id = `application:${randomUUID()}`;
      const version = `version:${randomUUID()}`;
      const document = parseExperience(original.configuration);
      const configuration = serializeExperience({ ...document, application: id });
      await database.query(
        `insert into experience.application(id,scope_id,code,public_slug,name,status,created_at,updated_at,version)
        values($1,$2,$3,$4,$5,'draft',clock_timestamp(),clock_timestamp(),0)`,
        [id, original.scope_id, identity.code, identity.publicSlug, name]
      );
      await database.query(
        `insert into experience.version(id,application_id,sequence,schema_version,configuration,configuration_hash,validation_state,reason,created_by,created_at)
        values($1,$2,1,'2',$3::jsonb,$4,$5,$6,$7,clock_timestamp())`,
        [version, id, configuration, createHash('sha256').update(configuration).digest('hex'), original.validation_state, textField(body, 'reason', 500), access.actor.id]
      );
      await database.query('insert into experience.binding(application_id,domain,mall_id,pool_id) values($1,$2,$3,$4)', [id, identity.publicSlug, original.mall_id, original.pool_id]);
      const result = await database.query('update experience.application set head_version_id=$2,version=1,updated_at=clock_timestamp() where id=$1 returning *', [id, version]);
      return { status: 201, body: { ...result.rows[0], versionId: version } };
    },
    'experience.applications.read': async (request, database) => {
      const access = requireAccess(request);
      const page = queryPage(request);
      const application = queryText(request.input.query.application);
      const scopes = await organizations.descendants(database, organizationScope(access.scope));
      const result = await database.query(
        `select application.id,application.scope_id,application.code,application.public_slug,application.name,application.status,application.version,
        application.created_at,application.updated_at,head.id head_id,head.sequence head_sequence,head.schema_version head_schema_version,
        head.configuration head_configuration,head.validation_state head_validation_state,head.reason head_reason,head.created_at head_created_at,
        published.id published_id,published.sequence published_sequence,published.schema_version published_schema_version,
        published.configuration published_configuration,published.validation_state published_validation_state,published.reason published_reason,published.created_at published_created_at,
        binding.domain,binding.mall_id,binding.pool_id,coalesce(history.items,'[]'::jsonb) history
        from experience.application application left join experience.version head on head.id=application.head_version_id
        left join lateral(select version.id,version.application_id,version.sequence,version.schema_version,version.configuration,
          version.configuration_hash,version.validation_state,version.created_by,version.created_at,version.reason
          from experience.release release join experience.version version on version.id=release.version_id
          where release.application_id=application.id and release.state in('active','scheduled') order by case release.state when 'active' then 0 else 1 end,
          release.effective_at desc,release.id desc limit 1) published on true
        left join lateral(select domain,mall_id,pool_id from experience.binding where application_id=application.id order by domain limit 1) binding on true
        left join lateral(select jsonb_agg(jsonb_build_object('id',version.id,'sequence',version.sequence,'schemaVersion',version.schema_version,
          'configuration',version.configuration,'validationState',version.validation_state,'reason',version.reason,
          'createdAt',to_char(version.created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
          'lifecycle',case when exists(select 1 from experience.release release where release.version_id=version.id and release.state in('active','scheduled'))
            then 'published' else 'draft' end) order by version.sequence desc) items from experience.version version
          where version.application_id=application.id) history on true
        where application.scope_id=any($1::text[])
        and ($2='' or application.id=$2)
        and ($3::timestamptz is null or (application.updated_at,application.id)<($3::timestamptz,$4))
        order by application.updated_at desc,application.id desc limit $5`,
        [scopes, application, page.sort, page.id, page.fetch]
      );
      return keysetResult(result, page, 'updated_at');
    },
    'experience.applications.update': async (request, database) => {
      const body = bodyRecord(request);
      const result = await database.query(
        `update experience.application set name=coalesce($2,name),status=coalesce($3,status),version=version+1,updated_at=clock_timestamp()
        where id=$1 and ($4::bigint is null or version=$4) returning *`,
        [request.input.path.applicationid!, body.name ?? null, body.status ?? null, request.input.expectedVersion ?? null]
      );
      if (!result.rows[0]) throw new DomainError('VERSION_CONFLICT');
      return rowResult(result);
    },
    'experience.versions.save': async (request, database) => {
      const access = requireAccess(request);
      const body = bodyRecord(request);
      if (request.input.expectedVersion === undefined) throw new DomainError('EXPECTED_VERSION_REQUIRED');
      const configuration = body.configuration;
      if (!configuration || typeof configuration !== 'object' || Array.isArray(configuration)) throw new DomainError('VALIDATION_FAILED', { field: 'configuration' });
      if (String(body.schemaVersion) !== '2') throw new Error('EXPERIENCE_VERSION_INVALID');
      const document = parseExperience(configuration);
      if (document.application !== request.input.path.applicationid) throw new Error('EXPERIENCE_APPLICATION_INVALID');
      const application = await database.query<{ id: string }>(`select id from experience.application where id=$1 and version=$2 for update`, [request.input.path.applicationid!, request.input.expectedVersion]);
      if (!application.rows[0]) throw new DomainError('VERSION_CONFLICT');
      const canonical = serializeExperience(document);
      const version = `version:${randomUUID()}`;
      const result = await database.query(
        `insert into experience.version(id,application_id,sequence,schema_version,configuration,configuration_hash,validation_state,reason,created_by,created_at)
        select $1,$2,coalesce(max(sequence),0)+1,$3,$4::jsonb,$5,'pending',$6,$7,clock_timestamp() from experience.version where application_id=$2
        returning *`,
        [version, request.input.path.applicationid!, '2', canonical, createHash('sha256').update(canonical).digest('hex'), textField(body, 'reason', 500), access.actor.id]
      );
      await database.query(`update experience.application set head_version_id=$2,version=version+1,updated_at=clock_timestamp() where id=$1`, [request.input.path.applicationid!, version]);
      return rowResult(result, 201);
    },
    'experience.versions.validate': async (request, database) => {
      const loaded = await database.query<{ configuration: unknown; application_id: string }>('select configuration,application_id from experience.version where id=$1 for update', [request.input.path.versionid!]);
      const version = loaded.rows[0];
      if (!version) throw new DomainError('RESOURCE_NOT_FOUND');
      const valid = validConfiguration(version.configuration, version.application_id);
      const result = await database.query(`update experience.version set validation_state=$2 where id=$1 returning id,application_id,validation_state`, [request.input.path.versionid!, valid ? 'valid' : 'invalid']);
      return rowResult(result);
    },
    'experience.versions.publish': async (request, database) => {
      const access = requireAccess(request);
      if (request.input.expectedVersion === undefined) throw new DomainError('EXPECTED_VERSION_REQUIRED');
      const loaded = await database.query<{ application_id: string; validation_state: string; configuration: unknown }>(
        `select version.application_id,version.validation_state,version.configuration
        from experience.version version join experience.application application on application.id=version.application_id
        where version.id=$1 and application.version=$2 for update of version,application`,
        [request.input.path.versionid!, request.input.expectedVersion]
      );
      const version = loaded.rows[0];
      if (!version) throw new DomainError('VERSION_CONFLICT');
      const document = parseExperience(version.configuration);
      const binding = await database.query<{ pool_id: string }>('select pool_id from experience.binding where application_id=$1 limit 1', [version.application_id]);
      const referencesValid = binding.rows[0] ? await references.valid(database, document, binding.rows[0].pool_id) : false;
      policy.assertPublishable({
        schema: document.application === version.application_id,
        assets: safeAssets(version.configuration),
        actions: safeActions(version.configuration) && referencesValid,
        capabilities: true,
        bindings: Boolean(binding.rows[0]),
        preview: version.validation_state === 'valid',
      });
      const release = `release:${randomUUID()}`;
      const result = await database.query(
        `insert into experience.release(id,application_id,version_id,state,effective_at,published_by)
        values($1,$2,$3,'scheduled',clock_timestamp(),$4) returning *`,
        [release, version.application_id, request.input.path.versionid!, access.actor.id]
      );
      await database.query(
        `insert into runtime.outbox(id,event_type,event_version,aggregate_type,aggregate_id,scope_id,payload,trace_id,occurred_at,available_at)
        select $1::text,'experience.published',1,'experience',$2::text,application.scope_id,
          jsonb_build_object('release',$3::text,'application',$2::text,'version',$4::text,'hash',version.configuration_hash,
          'key','experience/'||application.public_slug||'/'||version.configuration_hash||'.json'),$5::text,clock_timestamp(),clock_timestamp()
        from experience.application application join experience.version version on version.id=$4::text where application.id=$2::text`,
        [`event:${randomUUID()}`, version.application_id, release, request.input.path.versionid!, access.trace]
      );
      return rowResult(result, 202);
    },
    'experience.versions.restore': async (request, database) => {
      const access = requireAccess(request);
      if (request.input.expectedVersion === undefined) throw new DomainError('EXPECTED_VERSION_REQUIRED');
      const source = await database.query<{ application_id: string }>('select application_id from experience.version where id=$1', [request.input.path.versionid!]);
      const applicationId = source.rows[0]?.application_id;
      if (!applicationId) throw new DomainError('RESOURCE_NOT_FOUND');
      const application = await database.query<{ id: string }>('select id from experience.application where id=$1 and version=$2 for update', [applicationId, request.input.expectedVersion]);
      if (!application.rows[0]) throw new DomainError('VERSION_CONFLICT');
      const version = `version:${randomUUID()}`;
      const body = bodyRecord(request);
      const result = await database.query(
        `insert into experience.version(id,application_id,sequence,schema_version,configuration,configuration_hash,validation_state,reason,created_by,created_at)
        select $1,source.application_id,(select coalesce(max(sequence),0)+1 from experience.version where application_id=source.application_id),source.schema_version,
          source.configuration,source.configuration_hash,'valid',$2,$3,clock_timestamp() from experience.version source where source.id=$4 returning *`,
        [version, textField(body, 'reason', 500), access.actor.id, request.input.path.versionid!]
      );
      await database.query(`update experience.application set head_version_id=$2,version=version+1,updated_at=clock_timestamp() where id=$1`, [applicationId, version]);
      return rowResult(result, 201);
    },
  });
}

function queryText(value: string | readonly string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim().slice(0, 255) ?? '';
}

function applicationIdentity(body: Readonly<Record<string, unknown>>): Readonly<{ code: string; publicSlug: string }> {
  const code = textField(body, 'code', 32);
  const publicSlug = textField(body, 'publicSlug', 48);
  if (!/^[A-Z][A-Z0-9_]{2,31}$/.test(code)) throw new DomainError('VALIDATION_FAILED', { field: 'code' });
  if (!/^[a-z0-9][a-z0-9-]{2,47}$/.test(publicSlug)) throw new DomainError('VALIDATION_FAILED', { field: 'publicSlug' });
  return Object.freeze({ code, publicSlug });
}

async function assertApplicationUnique(database: OperationDatabase, scope: string, name: string, identity: Readonly<{ code: string; publicSlug: string }>): Promise<void> {
  const result = await database.query<{ field: 'name' | 'code' | 'publicSlug' }>(
    `select case when name=$2 then 'name' when code=$3 then 'code' else 'publicSlug' end field
       from experience.application
      where scope_id=$1 and (name=$2 or code=$3 or public_slug=$4)
      order by case when name=$2 then 0 when code=$3 then 1 else 2 end limit 1`,
    [scope, name, identity.code, identity.publicSlug]
  );
  const conflict = result.rows[0];
  if (conflict) throw new DomainError('VALIDATION_FAILED', { field: conflict.field });
}

function initialConfiguration(application: string, name: string): string {
  return serializeExperience({
    version: 2,
    application,
    pages: [
      {
        id: `${application}:home`,
        path: 'home',
        blocks: [{ id: `${application}:home:hero`, component: 'hero', content: { title: name, subtitle: '企业福利，温暖抵达' } }],
      },
    ],
  });
}

function validConfiguration(value: unknown, application: string): boolean {
  try {
    return parseExperience(value).application === application;
  } catch {
    return false;
  }
}

function safeAssets(value: unknown): boolean {
  return !/(?:data:|javascript:|file:|blob:)/i.test(JSON.stringify(value));
}

function safeActions(value: unknown): boolean {
  try {
    const document = parseExperience(value);
    return document.pages.every((page) => page.blocks.every((block) => block.action === undefined || safeTarget(block.action.type, block.action.target)));
  } catch {
    return false;
  }
}

function safeTarget(type: string, target: string): boolean {
  if (type === 'link') return /^\/(?:page|pages)\/[a-z0-9/-]+(?:\?[a-z0-9&=_-]+)?$/i.test(target);
  return /^[a-zA-Z0-9:._-]{1,255}$/.test(target);
}
