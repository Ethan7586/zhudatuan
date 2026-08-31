import type { OperationDatabase } from '../../../../foundation/application/ModuleOperations';

export class ApplyRiskDecision {
  async execute(database: OperationDatabase, command: Readonly<{ decision: string; scope: string; listing: string }>): Promise<void> {
    if (!command.decision || !command.scope || !command.listing) throw new Error('CATALOG_RISK_COMMAND_INVALID');
    const result = await database.query(
      `update catalog.listing set status='unpublished',expires_at=clock_timestamp(),version=version+1,
      updated_at=clock_timestamp() where id=$1 and scope_id=$2 and status='published' returning id`,
      [command.listing, command.scope]
    );
    if (result.rowCount === 0) return;
    await database.query(
      `insert into runtime.outbox(id,event_type,event_version,aggregate_type,aggregate_id,scope_id,payload,trace_id,occurred_at,available_at)
      values($1,'catalog.listing.unpublished',1,'listing',$2,$3,jsonb_build_object('listing',$2,'reason','risk','decision',$4),$4,
      clock_timestamp(),clock_timestamp()) on conflict(id) do nothing`,
      [`event:catalog:risk:${command.decision}`, command.listing, command.scope, command.decision]
    );
  }
}
