import { randomUUID } from 'node:crypto';
import { PgRuntimeWriter } from '../../../../adapter/database/PgRuntimeWriter';
import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import { databaseInteger } from '../../../../foundation/persistence/DatabaseInteger';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type {
  Assignment,
  AssignmentPlan,
  AssignmentRepository,
  CapabilityDependency,
  CapabilityDisabledReason,
  CapabilityKind,
} from '../../application/port/AssignmentRepository';
import { Entitlement } from '../../domain/model/Entitlement';

interface AssignmentRow {
  readonly id: string;
  readonly scope_id: string;
  readonly capability_id: string;
  readonly name: string;
  readonly kind: CapabilityKind;
  readonly state: 'enabled' | 'disabled';
  readonly configured_state: 'enabled' | 'disabled' | null;
  readonly inherited_from: string | null;
  readonly quota: number | string | null;
  readonly effective_at: Date | string | null;
  readonly expires_at: Date | string | null;
  readonly version: number | string;
  readonly capability_version: number | string;
  readonly dependency_healthy: boolean;
  readonly disabled_reason: CapabilityDisabledReason | null;
  readonly dependencies: CapabilityDependency[];
  readonly operations: number | string;
  readonly dependent_capabilities: number | string;
}

interface EntitlementRow {
  readonly id: string;
  readonly scope_id: string;
  readonly capability_id: string;
  readonly state: 'enabled' | 'disabled';
  readonly quota: number | string | null;
  readonly effective_at: Date | string;
  readonly expires_at: Date | string | null;
  readonly version: number | string;
}

export class PgAssignmentRepository implements AssignmentRepository {
  constructor(private readonly transactions = new PgTransactionAccess()) {}

  async list(context: ReadTransactionContext, input: Parameters<AssignmentRepository['list']>[1]): Promise<readonly Assignment[]> {
    const rows = await this.projectionRows(context, input.scope, null, input.sort, input.id, input.fetch);
    return Object.freeze(rows.map((row) => assignment(row, input.descendants)));
  }

  async prepare(context: WriteTransactionContext, input: Parameters<AssignmentRepository['prepare']>[1]): Promise<AssignmentPlan | null> {
    const database = this.transactions.database(context);
    const catalog = await database.query<{ operations: number; dependents: number }>(
      `select count(distinct operation.operation_id)::integer operations,
       count(distinct dependency.capability_id)::integer dependents
       from capability.capability catalog
       left join capability.operation operation on operation.capability_id=catalog.id
       left join capability.dependency dependency on dependency.depends_on_id=catalog.id
       where catalog.id=$1 and catalog.status='active' group by catalog.id`,
      [input.capability]
    );
    if (!catalog.rows[0]) return null;
    await database.query(
      `insert into capability.capabilityset(scope_id,version,updated_at) values($1,0,clock_timestamp())
       on conflict(scope_id) do nothing`,
      [input.scope]
    );
    const set = await database.query<{ version: number | string }>('select version from capability.capabilityset where scope_id=$1 for update', [input.scope]);
    const currentResult = await database.query<EntitlementRow>(
      `select id,scope_id,capability_id,state,quota,effective_at,expires_at,version
       from capability.entitlement where id=$1 or (scope_id=$2 and capability_id=$3) for update`,
      [input.id, input.scope, input.capability]
    );
    const currentRow = currentResult.rows[0];
    if (currentRow && (currentRow.id !== input.id || currentRow.scope_id !== input.scope || currentRow.capability_id !== input.capability)) return null;
    const parent = input.parent === null
      ? null
      : (await database.query<{ state: 'enabled' | 'disabled'; quota: number | string | null }>(
          `select state,quota from capability.effective_entitlements(array[$1])
           where scope_id=$1 and capability_id=$2`,
          [input.parent, input.capability]
        )).rows[0];
    const dependencyRows = await database.query<{
      capability_id: string;
      name: string;
      healthy: boolean;
      reason: CapabilityDisabledReason | null;
    }>(
      `with effective as materialized(
         select entitlement.scope_id,entitlement.capability_id,entitlement.state,entitlement.quota,
           entitlement.source_scope_id,entitlement.source_entitlement_id,entitlement.source_version,
           entitlement.effective_at,entitlement.expires_at,entitlement.disabled_reason,
           entitlement.dependencies_healthy,entitlement.capability_version
         from capability.effective_entitlements(array[$1]) entitlement
       )
       select dependency.depends_on_id capability_id,required.name,
       coalesce(effective.state='enabled' and effective.dependencies_healthy,false) healthy,
       effective.disabled_reason reason
       from capability.dependency dependency
       join capability.capability required on required.id=dependency.depends_on_id
       left join effective on effective.scope_id=$1 and effective.capability_id=dependency.depends_on_id
       where dependency.capability_id=$2 order by required.name,required.id`,
      [input.scope, input.capability]
    );
    return Object.freeze({
      current: currentRow ? entitlement(currentRow) : null,
      setVersion: databaseInteger(set.rows[0]?.version ?? 0),
      parent: parent ? Object.freeze({ scope: input.parent!, state: parent.state, quota: nullableInteger(parent.quota) }) : null,
      dependencies: Object.freeze(dependencyRows.rows.map(dependency)),
      operations: databaseInteger(catalog.rows[0].operations),
      dependentCapabilities: databaseInteger(catalog.rows[0].dependents),
    });
  }

  async project(context: ReadTransactionContext, input: Parameters<AssignmentRepository['project']>[1]): Promise<Assignment | null> {
    const rows = await this.projectionRows(context, input.scope, input.capability, null, null, 1);
    return rows[0] ? assignment(rows[0], input.descendants) : null;
  }

  async save(context: WriteTransactionContext, change: Parameters<AssignmentRepository['save']>[1], input: Parameters<AssignmentRepository['save']>[2]): Promise<Assignment | null> {
    const database = this.transactions.database(context);
    const target = change.entitlement;
    const result = await database.query<EntitlementRow>(
      `insert into capability.entitlement(id,scope_id,capability_id,state,quota,effective_at,expires_at,version,created_at,updated_at,updated_by,reason)
       values($1,$2,$3,$4,$5,$6,$7,1,clock_timestamp(),clock_timestamp(),$9,$10)
       on conflict(scope_id,capability_id) do update set state=excluded.state,quota=excluded.quota,
       effective_at=excluded.effective_at,expires_at=excluded.expires_at,version=capability.entitlement.version+1,
       updated_at=clock_timestamp(),updated_by=excluded.updated_by,reason=excluded.reason
       where capability.entitlement.id=$1 and capability.entitlement.version=$8
       returning id,scope_id,capability_id,state,quota,effective_at,expires_at,version`,
      [target.id, target.scope, target.capability, target.state, target.quota, target.effectiveAt, target.expiresAt, target.version - 1, input.actor, input.reason]
    );
    const stored = result.rows[0];
    if (!stored || databaseInteger(stored.version) !== target.version) return null;
    await database.query(
      `insert into capability.entitlementhistory(id,entitlement_id,scope_id,capability_id,state,quota,effective_at,expires_at,version,actor_id,reason,recorded_at)
       values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,clock_timestamp())`,
      [`entitlementhistory:${randomUUID()}`, stored.id, stored.scope_id, stored.capability_id, stored.state, stored.quota, stored.effective_at, stored.expires_at, stored.version, input.actor, input.reason]
    );
    const version = await database.query<{ version: number | string }>(
      `update capability.capabilityset set version=version+1,updated_at=clock_timestamp()
       where scope_id=$1 and version=$2 returning version`,
      [target.scope, input.expectedSetVersion]
    );
    if (databaseInteger(version.rows[0]?.version ?? -1) !== change.setVersion) return null;
    const projected = await this.project(context, { scope: target.scope, capability: target.capability, descendants: input.descendants });
    if (projected === null) return null;
    await new PgRuntimeWriter(database).append({
      id: `event:${randomUUID()}`,
      type: 'capability.changed',
      aggregateType: 'capabilityset',
      aggregate: target.scope,
      scope: target.scope,
      payload: { scopeId: target.scope, capability: target.capability, state: projected.state, version: projected.capabilityVersion },
      trace: input.trace,
    });
    return projected;
  }

  private async projectionRows(
    context: ReadTransactionContext,
    scope: string,
    capability: string | null,
    sort: string | null,
    id: string | null,
    fetch: number
  ): Promise<readonly AssignmentRow[]> {
    const database = this.transactions.database(context);
    const result = await database.query<AssignmentRow>(
      `with effective as materialized(
         select entitlement.scope_id,entitlement.capability_id,entitlement.state,entitlement.quota,
           entitlement.source_scope_id,entitlement.source_entitlement_id,entitlement.source_version,
           entitlement.effective_at,entitlement.expires_at,entitlement.disabled_reason,
           entitlement.dependencies_healthy,entitlement.capability_version
         from capability.effective_entitlements(array[$1]) entitlement
       )
       select coalesce(direct.id,'entitlement:'||md5($1||':'||catalog.id)) id,$1 scope_id,catalog.id capability_id,
       catalog.name,catalog.kind,effective.state,direct.state configured_state,
       case when effective.source_scope_id=$1 then null else effective.source_scope_id end inherited_from,
       effective.quota,effective.effective_at,effective.expires_at,coalesce(direct.version,0) version,
       effective.capability_version,effective.dependencies_healthy dependency_healthy,effective.disabled_reason,
       coalesce((select jsonb_agg(jsonb_build_object('capabilityId',required.id,'name',required.name,
         'healthy',coalesce(requiredstate.state='enabled' and requiredstate.dependencies_healthy,false),
         'reason',requiredstate.disabled_reason) order by required.name,required.id)
         from capability.dependency dependency join capability.capability required on required.id=dependency.depends_on_id
         left join effective requiredstate on requiredstate.scope_id=$1 and requiredstate.capability_id=required.id
         where dependency.capability_id=catalog.id),'[]'::jsonb) dependencies,
       (select count(*)::integer from capability.operation operation where operation.capability_id=catalog.id) operations,
       (select count(*)::integer from capability.dependency dependent where dependent.depends_on_id=catalog.id) dependent_capabilities
       from capability.capability catalog
       join effective on effective.scope_id=$1 and effective.capability_id=catalog.id
       left join capability.entitlement direct on direct.scope_id=$1 and direct.capability_id=catalog.id
       where catalog.status='active' and ($2::text is null or catalog.id=$2)
         and ($3::text is null or (catalog.name,catalog.id)>($3,$4))
       order by catalog.name,catalog.id limit $5`,
      [scope, capability, sort, id, fetch]
    );
    return result.rows;
  }
}

function assignment(row: AssignmentRow, descendants: number): Assignment {
  return Object.freeze({
    id: row.id,
    scopeId: row.scope_id,
    capabilityId: row.capability_id,
    name: row.name,
    kind: row.kind,
    state: row.state,
    configuredState: row.configured_state,
    inheritedFrom: row.inherited_from,
    quota: nullableInteger(row.quota),
    effectiveAt: nullableUtc(row.effective_at),
    expiresAt: nullableUtc(row.expires_at),
    version: databaseInteger(row.version),
    capabilityVersion: databaseInteger(row.capability_version),
    dependencyHealthy: row.dependency_healthy,
    disabledReason: row.disabled_reason,
    dependencies: Object.freeze(row.dependencies.map((item) => Object.freeze(item))),
    impact: Object.freeze({
      operations: databaseInteger(row.operations),
      dependentCapabilities: databaseInteger(row.dependent_capabilities),
      descendantScopes: descendants,
      navigationAffected: true,
    }),
  });
}

function entitlement(row: EntitlementRow): Entitlement {
  return new Entitlement({
    id: row.id,
    scope: row.scope_id,
    capability: row.capability_id,
    state: row.state,
    quota: nullableInteger(row.quota),
    effectiveAt: date(row.effective_at),
    expiresAt: row.expires_at === null ? null : date(row.expires_at),
    version: databaseInteger(row.version),
  });
}

function dependency(row: Readonly<{ capability_id: string; name: string; healthy: boolean; reason: CapabilityDisabledReason | null }>): CapabilityDependency {
  return Object.freeze({ capabilityId: row.capability_id, name: row.name, healthy: row.healthy, reason: row.reason });
}

function nullableInteger(value: number | string | null): number | null {
  return value === null ? null : databaseInteger(value);
}

function nullableUtc(value: Date | string | null): string | null {
  return value === null ? null : date(value).toISOString();
}

function date(value: Date | string): Date {
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error('CAPABILITY_TIME_INVALID');
  return parsed;
}
