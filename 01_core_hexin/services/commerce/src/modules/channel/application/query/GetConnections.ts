import type { OperationActions } from '../../../../foundation/application/ModuleOperations';
import { requireAccess } from '../../../../foundation/application/ModuleOperations';
import { keysetResult, queryPage } from '../../../../foundation/interface/Validation';
import type { ExtensionRepositoryFactory } from '../../../extension/ExtensionModule';

export function getConnectionsOperations(extensions:ExtensionRepositoryFactory): OperationActions {
  return { 'channel.connections.read': async (request, database) => {
    const access = requireAccess(request); const page = queryPage(request);
    const result = await database.query(`select connection.id,connection.provider,connection.scope_id,connection.status,
      connection.contract_version,connection.region,connection.connection_timeout_ms,connection.response_timeout_ms,
      connection.total_deadline_ms,connection.max_concurrency,connection.requests_per_second,connection.max_attempts,
      connection.failure_threshold,connection.recovery_ms,connection.version,connection.created_at,connection.updated_at,
      connection.secret_ref is not null has_secret from channel.connection connection
      where connection.scope_id=$1 and ($2::text is null or connection.id>$2) order by connection.id limit $3`,
    [access.scope.id, page.id, page.fetch]);
    const summaries=new Map((await extensions(database).summaries(result.rows.map((row)=>String(row.id)))).map((item)=>[item.id,item]));
    result.rows=result.rows.map((row)=>({ ...row,...summaries.get(String(row.id)) }));
    return keysetResult(result, page, 'id');
  } };
}
