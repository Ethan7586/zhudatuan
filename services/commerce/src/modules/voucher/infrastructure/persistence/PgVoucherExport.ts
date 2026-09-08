import type { ExportPort, JobPort } from '../../../runtime/public';
import type { OperationId } from '@shop/contract';
import { PgTransactionAccess, type SqlExecutor } from '../../../../platform/database/PgTransactionAccess';
import type { VoucherExport } from '../../application/port/VoucherExport';
import type { VoucherCall } from '../../application/port/VoucherCall';
import { body, requiredIdempotency, text, write } from './VoucherSupport';
import { readSearchSnapshot } from './SearchSnapshot';
import { exportAuthorization } from '../../application/service/ExportAuthorization';
import { captureExportSnapshot } from './ExportSnapshot';

export class PgVoucherExport implements VoucherExport {
  constructor(
    private readonly exports: ExportPort,
    private readonly jobs: JobPort,
    private readonly transactions = new PgTransactionAccess()
  ) {}
  async search(call: Parameters<VoucherExport['search']>[0]) {
    const value = body(call);
    const snapshot = text(value.snapshot, 'snapshot');
    const projection = await readSearchSnapshot(this.transactions.database(call.context.transaction), call.scope, snapshot, call.actor, call.now);
    const result = await createVoucherExport(
      call,
      { kind: 'search', snapshot: projection },
      {
        database: this.transactions.database(call.context.transaction),
        exports: this.exports,
        jobs: this.jobs,
      }
    );
    return { status: 202, body: result };
  }
}

export async function createVoucherExport(
  call: VoucherCall<OperationId>,
  input: Readonly<{
    kind: 'credential' | 'issueorder' | 'action' | 'search';
    snapshot: Readonly<Record<string, unknown>>;
    poolVersion?: number;
  }>,
  ports: Readonly<{ database: SqlExecutor; exports: ExportPort; jobs: JobPort }>
) {
  const idempotency = requiredIdempotency(call);
  const result = await ports.exports.create(write(call), {
    scope: call.scope,
    owner: 'voucher',
    kind: input.kind,
    snapshot: input.snapshot,
    authorization: { ...exportAuthorization(call, text(body(call).reason, 'reason')), ...(input.poolVersion === undefined ? {} : { poolVersion: input.poolVersion }) },
    idempotency,
    actor: call.actor,
  });
  if (input.kind !== 'search') await captureExportSnapshot(ports.database, { id: result.id, scope: call.scope, kind: input.kind, actor: call.actor, filter: input.snapshot });
  await ports.jobs.create(write(call), { scope: call.scope, owner: 'voucher', kind: 'voucherexport', queue: 'export', payload: { export: result.id }, idempotency: `${result.id}:${idempotency}`, actor: call.actor });
  return result;
}
