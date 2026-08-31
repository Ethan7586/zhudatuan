import type { Transaction } from '../persistence/UnitOfWork';

export interface ApiDatabaseContext {
  readonly tenant: string;
  readonly membership: string;
  readonly scope: string;
  readonly actor: string;
  readonly trace: string;
  readonly operation?: string;
}

export function applyApiDatabaseContext(database: Transaction, context: ApiDatabaseContext): Promise<unknown> {
  return database.query(
    `select set_config('app.tenant_id',$1,true),set_config('app.membership_id',$2,true),set_config('app.scope_id',$3,true),
    set_config('app.actor_id',$4,true),set_config('app.trace_id',$5,true),set_config('app.operation_id',$6,true),set_config('app.workload','api',true)`,
    [context.tenant, context.membership, context.scope, context.actor, context.trace, context.operation ?? '']
  );
}

export function applyJobDatabaseContext(database: Transaction, scope = ''): Promise<unknown> {
  return database.query("select set_config('app.scope_id',$1,true),set_config('app.workload','jobs',true)", [scope]);
}

export function applyApiScope(database: Transaction, scope: string): Promise<unknown> {
  return database.query("select set_config('app.scope_id',$1,true)", [scope]);
}
