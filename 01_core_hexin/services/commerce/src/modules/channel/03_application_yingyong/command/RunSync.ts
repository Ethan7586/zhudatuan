import { createHash, randomUUID } from 'node:crypto';
import type { OperationActions } from '../../../../foundation/application/ModuleOperations';
import { requireAccess, rowResult } from '../../../../foundation/application/ModuleOperations';
import { bodyRecord, textField } from '../../../../foundation/interface/Validation';
import type { SyncKind } from '../../02_domain_yewu/model/SyncRun';
import type { ChannelRepositoryFactory } from '../port/ChannelRepository';

const jobs = Object.freeze({ catalog: 'catalogsync', price: 'pricesync', stock: 'inventorysync', statement: 'statementsync' } as const);

export function runSyncOperations(repository: ChannelRepositoryFactory): OperationActions {
  return {
    'channel.syncruns.start': async (request, database) => {
      const access = requireAccess(request); const body = bodyRecord(request); const connection = textField(body, 'connection');
      const kind = syncKind(textField(body, 'kind', 64));
      const parameters = kind === 'statement' ? { start: date(body.start), end: date(body.end),
        timezone: required(body.timezone, 'STATEMENT_TIMEZONE_REQUIRED'), partner: required(body.partner, 'STATEMENT_PARTNER_REQUIRED') } : {};
      const input = JSON.stringify({ connection, kind, cursor: body.cursor ?? null, ...parameters }); const run = `sync:${randomUUID()}`;
      const accepted = await database.query(`insert into channel.syncrun(id,connection_id,kind,state,cursor_value,input_hash,input,error_summary)
        select $1,id,$3,'queued',$4,$5,$6::jsonb,'[]'::jsonb from channel.connection where id=$2 and scope_id=$7
        and status='enabled' returning *`, [run, connection, kind, body.cursor ?? null,
        createHash('sha256').update(input).digest('hex'), input, access.scope.id]);
      if (!accepted.rows[0]) throw new Error('ENABLED_CONNECTION_REQUIRED');
      await repository(database).enqueue(jobs[kind], access.scope.id, { subtype: 'channelsync', run }, 30);
      return rowResult(accepted, 202);
    },
    'channel.syncruns.cancel': async (request, database) => {
      const access = requireAccess(request);
      return rowResult(await database.query(`update channel.syncrun run set state='cancelled',completed_at=clock_timestamp()
        from channel.connection connection where run.id=$1 and connection.id=run.connection_id and connection.scope_id=$2
        and run.state in('queued','running') returning run.*`, [request.input.path.runid!, access.scope.id]));
    },
  };
}

function syncKind(value: string): SyncKind { if (!(value in jobs)) throw new Error('SYNC_KIND_INVALID'); return value as SyncKind; }
function required(value: unknown, code: string): string { if (typeof value !== 'string' || !value.trim()) throw new Error(code); return value.trim(); }
function date(value: unknown): string { const text = String(value ?? ''); if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new Error('STATEMENT_DATE_INVALID'); return text; }
