import { voucherLifecycle, type VoucherPersistence } from './VoucherAction';
import { randomUUID } from 'node:crypto';
import type { ModuleContext } from '../../../../bootstrap/ModuleRegistry';
import { prepareImport, projectImport, type ImportPreparation } from '../../../../foundation/application/ImportObjectService';

import { requireAccess } from '../../../../foundation/application/OperationAccess';
import { rowResult } from '../../../../adapter/database/DatabaseResult';
import { OBJECT_STORE } from '../../../../foundation/infrastructure/ObjectStore';
import { bodyRecord, textField } from '../../../../foundation/interface/Validation';
import { PgRuntimeWriter } from '../../../../adapter/database/PgRuntimeWriter';

interface CardLibraryPreparation {
  readonly access: ImportPreparation['access'];
  readonly body: Readonly<Record<string, unknown>>;
  readonly mode: 'generated' | 'imported';
  readonly source?: ImportPreparation;
}

export function voucherImportPersistence(context: ModuleContext): Pick<VoucherPersistence, 'create' | 'readImport'> {
  const objects = context.service(OBJECT_STORE);
  return {
    create: voucherLifecycle({
      prepare: async (request): Promise<CardLibraryPreparation> => {
        const access = requireAccess(request);
        const body = bodyRecord(request.input);
        const mode = textField(body, 'mode', 16);
        if (mode !== 'generated' && mode !== 'imported') throw new Error('VOUCHER_CARD_LIBRARY_MODE_INVALID');
        return { access, body, mode, ...(mode === 'imported' ? { source: await prepareImport(request, objects) } : {}) };
      },
      execute: async (_request, database, prepared) => {
        const cardpool = `cardpool:${randomUUID()}`;
        const result = await database.query(
          `insert into voucher.cardpool(id,scope_id,code_prefix,next_sequence,provider,mode,status,version)
          values($1,$2,$3,1,$4,$5,case when $5='imported' then 'draft' else 'ready' end,0) returning *`,
          [cardpool, prepared.access.scope.id, textField(prepared.body, 'prefix', 32), prepared.body.provider ?? null, prepared.mode]
        );
        if (!prepared.source) return rowResult(result, 201);
        const id = `voucherimport:${randomUUID()}`;
        await database.query(
          `insert into voucher.importjob(id,cardpool_id,scope_id,object_ref,sha256,state,total_count,success_count,failure_count,created_at,updated_at)
          values($1,$2,$3,$4,$5,'uploaded',0,0,0,clock_timestamp(),clock_timestamp())`,
          [id, cardpool, prepared.access.scope.id, prepared.source.reference, prepared.source.sha256]
        );
        await new PgRuntimeWriter(database).schedule({ id: `job:${id}:0`, kind: 'voucherimport', owner: 'voucher', scope: prepared.access.scope.id, payload: { import: id }, priority: 20 });
        return { status: 201, body: { ...result.rows[0], import: id }, headers: { etag: '"0"' } };
      },
    }),
    readImport: voucherLifecycle({
      execute: async (request, database) => {
        const access = requireAccess(request);
        return rowResult(
          await database.query(
            `select job.id,job.cardpool_id,job.state,job.total_count,job.cursor_value,job.success_count,job.failure_count,
          job.validation_summary,job.last_error,job.report_object_ref,job.report_sha256,job.report_size,job.created_at,job.updated_at,
          coalesce((select jsonb_agg(row_to_json(errorrow) order by errorrow.row_number) from
            (select row_number,reason_code,field,detail from voucher.importerror where job_id=job.id order by row_number limit 100) errorrow),'[]'::jsonb) errors
          from voucher.importjob job where job.id=$1 and access.scope_allowed(job.scope_id)`,
            [request.input.path.importid!]
          )
        );
      },
      finalize: async (_request, result) => projectImport(result, objects),
    }),
  };
}
