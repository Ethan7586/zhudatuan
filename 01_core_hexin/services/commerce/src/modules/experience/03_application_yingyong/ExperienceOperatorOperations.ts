import { randomUUID } from 'node:crypto';
import type { OperationId } from '@shop/contract';
import type { ModuleContext } from '../../../bootstrap/ModuleRegistry';
import { AUDIT_SINK } from '../../../foundation/application/AuditSink';
import { ModuleOperations, requireAccess, rowResult, type OperationActions } from '../../../foundation/application/ModuleOperations';
import { bodyRecord, textField } from '../../../foundation/interface/Validation';
import { DATABASE_POOL } from '../../../foundation/persistence/Pool';
import { experienceOperatorReadActions } from './ExperienceReadOperations';

export const EXPERIENCE_OPERATOR_OPERATION_IDS = Object.freeze(['experience.applications.create', 'experience.applications.read', 'experience.applications.update', 'experience.applications.copy'] as const satisfies readonly OperationId[]);

export function experienceOperatorActions(): OperationActions {
  return {
    'experience.applications.create': async (request, database) => {
      const access = requireAccess(request);
      const body = bodyRecord(request);
      const identity = applicationIdentity(body);
      const result = await database.query(
        `insert into experience.application(id,scope_id,code,public_slug,name,status,created_at,updated_at,version)
          values($1,$2,$3,$4,$5,'draft',clock_timestamp(),clock_timestamp(),0) returning *`,
        [`application:${randomUUID()}`, access.scope.id, identity.code, identity.publicSlug, textField(body, 'name')]
      );
      return rowResult(result, 201);
    },
    ...experienceOperatorReadActions(),
    'experience.applications.update': async (request, database) => {
      if (request.input.expectedVersion === undefined) throw new Error('EXPECTED_VERSION_REQUIRED');
      const body = bodyRecord(request);
      const name = body.name === undefined ? null : textField(body, 'name');
      const status = body.status === undefined ? null : textField(body, 'status', 32);
      if (name === null && status === null) throw new Error('VALIDATION_FAILED');
      if (status !== null && status !== 'disabled') throw new Error('VALIDATION_FAILED:status');
      const result = await database.query(
        `update experience.application set name=coalesce($2,name),status=coalesce($3,status),version=version+1,updated_at=clock_timestamp()
          where id=$1 and version=$4 returning *`,
        [request.input.path.applicationid!, name, status, request.input.expectedVersion]
      );
      if (!result.rows[0]) throw new Error('VERSION_CONFLICT');
      return rowResult(result);
    },
    'experience.applications.copy': async (request, database) => {
      const access = requireAccess(request);
      const body = bodyRecord(request);
      const identity = applicationIdentity(body);
      const id = `application:${randomUUID()}`;
      const result = await database.query(
        `insert into experience.application(id,scope_id,code,public_slug,name,status,created_at,updated_at,version)
          select $1,$2,$3,$4,$5,'draft',clock_timestamp(),clock_timestamp(),0 from experience.application source
          where source.id=$6 and source.head_version_id is not null returning *`,
        [id, access.scope.id, identity.code, identity.publicSlug, textField(body, 'name'), request.input.path.applicationid!]
      );
      if (!result.rows[0]) throw new Error('EXPERIENCE_SOURCE_APPLICATION_INVALID');
      const version = `version:${randomUUID()}`;
      const copied = await database.query(
        `insert into experience.version(id,application_id,sequence,schema_version,configuration,configuration_hash,validation_state,reason,created_by,created_at)
          select $1,$2,1,version.schema_version,version.configuration,version.configuration_hash,version.validation_state,$3,$4,clock_timestamp()
          from experience.application source join experience.version version on version.id=source.head_version_id where source.id=$5`,
        [version, id, textField(body, 'reason', 500), access.actor.id, request.input.path.applicationid!]
      );
      if (copied.rowCount !== 1) throw new Error('EXPERIENCE_SOURCE_VERSION_INVALID');
      await database.query('update experience.application set head_version_id=$2 where id=$1', [id, version]);
      return { status: 201, body: { ...result.rows[0], versionId: version } };
    },
  };
}

export function experienceOperatorOperations(context: ModuleContext): ModuleOperations {
  return new ModuleOperations('experience', context.container.get(DATABASE_POOL), context.container.get(AUDIT_SINK), experienceOperatorActions(), EXPERIENCE_OPERATOR_OPERATION_IDS);
}

function applicationIdentity(body: Readonly<Record<string, unknown>>): Readonly<{ code: string; publicSlug: string }> {
  const code = textField(body, 'code', 32);
  const publicSlug = textField(body, 'publicSlug', 48);
  if (!/^[A-Z][A-Z0-9_]{2,31}$/.test(code)) throw new Error('VALIDATION_FAILED:code');
  if (!/^[a-z0-9][a-z0-9-]{2,47}$/.test(publicSlug)) throw new Error('VALIDATION_FAILED:publicSlug');
  return Object.freeze({ code, publicSlug });
}
