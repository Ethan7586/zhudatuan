import type { OperationActions } from '../../../../foundation/application/ModuleOperations';
import { requireAccess } from '../../../../foundation/application/ModuleOperations';
import { keysetResult, queryPage } from '../../../../foundation/interface/Validation';

export function getSyncRunsOperations(): OperationActions {
  return {
    'channel.syncruns.read': async (request, database) => {
      const access = requireAccess(request);
      const page = queryPage(request);
      const result = await database.query(
        `select run.id,run.connection_id,run.kind,run.state,run.cursor_value,run.input_hash,run.input,
      run.error_summary,run.watermark,run.pulled_count,run.accepted_count,run.rejected_count,run.started_at,run.completed_at,
      coalesce(run.started_at,'infinity')::text cursor_sort
      from channel.syncrun run join channel.connection connection on connection.id=run.connection_id where connection.scope_id=$1
      and ($2::timestamptz is null or (coalesce(run.started_at,'infinity'),run.id)<($2::timestamptz,$3))
      order by coalesce(run.started_at,'infinity') desc,run.id desc limit $4`,
        [access.scope.id, page.sort, page.id, page.fetch]
      );
      return keysetResult(result, page, 'cursor_sort');
    },
  };
}
