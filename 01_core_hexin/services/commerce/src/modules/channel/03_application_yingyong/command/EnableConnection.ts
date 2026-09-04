import type { OperationActions,OperationDatabase } from '../../../../foundation/application/ModuleOperations';
import { operationLifecycle,requireAccess,rowResult } from '../../../../foundation/application/ModuleOperations';
import type { DisableExtension,EnableExtension,ExtensionCandidate } from '../../../extension';
import { Connection,type ConnectionState } from '../../02_domain_yewu/model/Connection';

interface ConnectionRow { readonly id:string; readonly provider:string; readonly scope_id:string; readonly status:ConnectionState;
  readonly region:string; readonly connection_timeout_ms:number; readonly response_timeout_ms:number; readonly total_deadline_ms:number;
  readonly max_concurrency:number; readonly requests_per_second:number; readonly max_attempts:number; readonly failure_threshold:number;
  readonly recovery_ms:number; readonly version:number }

export function enableConnectionOperations(enable:EnableExtension,disable:DisableExtension):OperationActions {
  return {
    'channel.connections.test':async(request,database)=>{
      const access=requireAccess(request); const id=request.input.path.connectionid!; const row=await lock(database,id,access.scope.id);
      connection(row).requireTransition('testing');
      await enable.test(database,id,access.scope.id,access.actor.id,access.trace);
      const result=await update(database,row,'testing');
      return { status:202,body:{ ...result.rows[0],state:'testing' } };
    },
    'channel.connections.enable':operationLifecycle<ExtensionCandidate>({
      prepare:(request)=>{ const access=requireAccess(request); return enable.prepare(request.input.path.connectionid!,access); },
      execute:async(request,database,candidate)=>{
        const access=requireAccess(request); const row=await lock(database,candidate.installation,access.scope.id);
        connection(row).requireTransition('enabled');
        const displaced=await enable.enable(database,candidate,access.actor.id,access.trace);
        if (displaced) await database.query(`update channel.connection set status='disabled',version=version+1,updated_at=clock_timestamp()
          where id=$1 and scope_id=$2 and status='enabled'`,[displaced,access.scope.id]);
        return rowResult(await update(database,row,'enabled'));
      },
      finalize:async(_request,result,candidate)=>{ await enable.activate(candidate); return result; },
      discard:async(_request,candidate)=>enable.discard(candidate),
    }),
    'channel.connections.disable':operationLifecycle({
      execute:async(request,database)=>{
        const access=requireAccess(request); const id=request.input.path.connectionid!; const row=await lock(database,id,access.scope.id);
        connection(row).requireTransition('disabled');
        const provider=await disable.execute(database,id,access.scope.id,access.actor.id,access.trace);
        const result=await update(database,row,'disabled');
        return rowResult({ ...result,rows:result.rows.map((item)=>({ ...item,provider })) });
      },
      finalize:async(request,result)=>{ const body=result.body as ConnectionRow; await disable.finalize(body.provider,requireAccess(request).scope.id); return result; },
    }),
  };
}

async function lock(database:OperationDatabase,id:string,scope:string):Promise<ConnectionRow> {
  const result=await database.query<ConnectionRow>('select * from channel.connection where id=$1 and scope_id=$2 for update',[id,scope]);
  const row=result.rows[0]; if (!row) throw new Error('RESOURCE_NOT_FOUND'); return row;
}
function update(database:OperationDatabase,row:ConnectionRow,state:ConnectionState) {
  return database.query<ConnectionRow>(`update channel.connection set status=$3,version=version+1,updated_at=clock_timestamp()
    where id=$1 and scope_id=$2 and version=$4 returning *`,[row.id,row.scope_id,state,row.version]);
}
function connection(row:ConnectionRow):Connection { return new Connection(row.id,row.provider,row.scope_id,row.status,row.region,
  { connectionTimeoutMs:row.connection_timeout_ms,responseTimeoutMs:row.response_timeout_ms,totalDeadlineMs:row.total_deadline_ms,
    maxConcurrency:row.max_concurrency,requestsPerSecond:Number(row.requests_per_second),maxAttempts:row.max_attempts,
    failureThreshold:row.failure_threshold,recoveryMs:row.recovery_ms },row.version); }
