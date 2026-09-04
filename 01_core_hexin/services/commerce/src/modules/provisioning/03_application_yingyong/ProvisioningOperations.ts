import type { OperationId } from '@shop/contract';
import type { ModuleContext } from '../../../bootstrap/ModuleRegistry';
import { AUDIT_SINK } from '../../../foundation/application/AuditSink';
import { ModuleOperations, reject, requireAccess } from '../../../foundation/application/ModuleOperations';
import { bodyRecord, optionalText, textField } from '../../../foundation/interface/Validation';
import { DATABASE_POOL } from '../../../foundation/persistence/Pool';
import { CreateMall } from './CreateMall';

export const MALL_PROVISIONING_OPERATION_IDS = Object.freeze([
  'provisioning.malls.create',
  'provisioning.malls.read',
] as const satisfies readonly OperationId[]);

export function provisioningOperations(context: ModuleContext): ModuleOperations {
  const pool = context.container.get(DATABASE_POOL);
  const createMall = new CreateMall();
  return new ModuleOperations('provisioning', pool, context.container.get(AUDIT_SINK), {
    'provisioning.malls.create': async (request, database) => {
      const access = requireAccess(request);
      const body = bodyRecord(request);
      const code = textField(body, 'code', 32);
      const publicSlug = textField(body, 'publicSlug', 48);
      if (!/^[A-Z][A-Z0-9_]{2,31}$/.test(code)) throw new Error('VALIDATION_FAILED:code');
      if (!/^[a-z0-9][a-z0-9-]{2,47}$/.test(publicSlug)) throw new Error('VALIDATION_FAILED:publicSlug');
      const plan = createMall.plan({
        scope: access.scope.id,
        parent: optionalText(body, 'parentId') ?? textField(body, 'enterpriseId'),
        code,
        publicSlug,
        name: textField(body, 'name'),
        actor: access.actor.id,
        actorMembership: access.membership.id,
      });
      const conflict = await createMall.preflight(database, plan);
      if (conflict !== null) reject(conflict === 'MALL_PARENT_INVALID' ? 422 : 409, conflict);
      return { status: 201, body: await createMall.execute(database, plan) };
    },
    'provisioning.malls.read': async (request, database) => {
      requireAccess(request);
      const mall = await createMall.read(database, request.input.path.mallid!);
      if (!mall) reject(404, 'RESOURCE_NOT_FOUND');
      return { status: 200, body: mall };
    },
  }, MALL_PROVISIONING_OPERATION_IDS);
}
