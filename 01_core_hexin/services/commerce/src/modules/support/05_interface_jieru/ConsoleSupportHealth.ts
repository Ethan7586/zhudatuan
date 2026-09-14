import type { ModuleContext } from '../../../bootstrap/ModuleRegistry';
import type { OperationRequest, OperationResult, OperationUsecase } from '../../../foundation/application/OperationHandler';
import { DATABASE_POOL, type DatabasePool } from '../../../foundation/persistence/Pool';

const OPERATIONS = ['support.cases.create', 'support.cases.read', 'support.messages.read', 'support.messages.send'] as const;

class ConsoleSupportHealth implements OperationUsecase {
  constructor(private readonly pool: DatabasePool) {}

  async invoke(request: OperationRequest): Promise<OperationResult> {
    if (request.type === 'runtime.health.live') return { status: 200, body: { status: 'live' } };
    if (request.type === 'runtime.health.dependency') throw new Error('OPERATION_NOT_EXPOSED');
    const result = await this.pool.query<{ role_ok: boolean; schema_ok: boolean; create_access: boolean; operations: number }>(`select
      current_user='shopconsole' role_ok,
      to_regclass('support.ticket') is not null and to_regclass('support.conversation') is not null
        and to_regclass('support.message') is not null and to_regclass('support.sla') is not null
        and to_regclass('runtime.idempotency') is not null and to_regclass('runtime.job') is not null schema_ok,
      has_table_privilege(current_user,'support.ticket','INSERT')
        and has_table_privilege(current_user,'support.conversation','INSERT')
        and has_table_privilege(current_user,'support.sla','SELECT')
        and has_table_privilege(current_user,'runtime.job','INSERT') create_access,
      (select count(*)::integer from runtime.operation where id=any($1::text[])) operations`, [OPERATIONS]);
    const state = result.rows[0];
    const healthy = state?.role_ok === true && state.schema_ok === true && state.create_access === true
      && state.operations === OPERATIONS.length;
    return { status: healthy ? 200 : 503, body: { status: healthy
      ? request.type === 'runtime.health.ready' ? 'ready' : 'started'
      : request.type === 'runtime.health.ready' ? 'unready' : 'blocked', database: state } };
  }
}

export function consoleSupportHealth(context: ModuleContext): OperationUsecase {
  return new ConsoleSupportHealth(context.container.get(DATABASE_POOL));
}
