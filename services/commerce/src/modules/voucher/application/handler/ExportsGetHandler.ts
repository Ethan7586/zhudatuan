import { OperationCatalog, type OperationInputFor, type OperationOutputFor } from '@shop/contract';
import { RUNTIME_LIMITS } from '@shop/config/runtime';
import type { CommitContext, FinalizeContext, PrepareContext } from '../../../../foundation/application/HandlerContext';
import type { DurableOperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import { DomainError } from '../../../../foundation/domain/DomainError';
import type { ObjectStore } from '../../../runtime/public/ObjectPort';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
import { StepupPolicy } from '../../../../foundation/security/StepupPolicy';
import type { TransactionManager } from '../../../../foundation/persistence/TransactionManager';
import type { TaskAuthorizationPort } from '../../../access/public';
import type { ExportPort, RuntimeExportDownload, RuntimeExportRecord, RuntimeExportWork } from '../../../runtime/public';
import { assertExportWork } from '../service/ExportAuthorization';

type Reply = OperationReply<OperationOutputFor<'voucher.exports.get'>>;
type Checkpoint = Readonly<{ readonly record: RuntimeExportRecord; readonly download: RuntimeExportDownload | null; readonly work: RuntimeExportWork }>;

export class ExportsGetHandler implements DurableOperationHandler<'voucher.exports.get', null, Checkpoint, 'write'> {
  readonly operation = 'voucher.exports.get' as const;
  readonly mode = 'write' as const;
  constructor(private readonly exports: ExportPort, private readonly objects: ObjectStore, private readonly authorization: TaskAuthorizationPort,
    private readonly transactions: TransactionManager, private readonly stepup = new StepupPolicy()) {}
  prepare(_input: OperationInputFor<'voucher.exports.get'>, _context: PrepareContext<'voucher.exports.get'>): Promise<null> { return Promise.resolve(null); }
  async commit(input: OperationInputFor<'voucher.exports.get'>, _prepared: null, context: CommitContext<'voucher.exports.get'>) {
    const access = requireSession(context.security);
    const work = await this.exports.work(context.transaction, input.path.exportid, access.scope.id, 'voucher');
    if (!work) throw new DomainError('RESOURCE_NOT_FOUND');
    this.assertOwner(work, context);
    await this.authorization.assert(context.transaction, work.authorization);
    const record = await this.exports.read(context.transaction, input.path.exportid, access.scope.id, 'voucher');
    if (!record) throw new DomainError('RESOURCE_NOT_FOUND');
    if (record.state === 'completed' && downloadSeconds(record) >= 60) this.assertAssurance(work, context);
    const download = record.state === 'completed' && downloadSeconds(record) >= 60
      ? await this.exports.take(context.transaction, record.id, access.scope.id, 'voucher')
      : null;
    return Object.freeze({ checkpoint: Object.freeze({ record, download, work }), response: { status: 200, body: download?.record ?? record } as Reply });
  }
  async finalize(_input: OperationInputFor<'voucher.exports.get'>, checkpoint: Checkpoint, context: FinalizeContext<'voucher.exports.get'>): Promise<Reply> {
    if (!checkpoint.download) return { status: 200, body: checkpoint.record };
    this.assertOwner(checkpoint.work, context);
    this.assertAssurance(checkpoint.work, context);
    const access = requireSession(context.security);
    await this.transactions.read({ tenant: access.scope.id, scope: access.scope.id, membership: access.actor.membership, actor: access.actor.id,
      trace: context.traceId, operation: context.operation, deadline: context.deadline, signal: context.signal },
    transaction => this.authorization.assert(transaction, checkpoint.work.authorization));
    const seconds = downloadSeconds(checkpoint.download.record);
    if (seconds < 60) throw new DomainError('VOUCHER_EXPORT_NOT_READY');
    const signed = await this.objects.authorize(checkpoint.download.reference, seconds);
    const signedExpiry = Date.parse(signed.expiresAt);
    if (!Number.isFinite(signedExpiry) || signedExpiry <= Date.now() || signedExpiry > Date.parse(checkpoint.download.record.expiresAt))
      throw new DomainError('VOUCHER_EXPORT_NOT_READY');
    return { status: 200, body: { ...checkpoint.download.record, downloadToken: signed.url } };
  }
  private assertOwner(work: RuntimeExportWork, context: PrepareContext<'voucher.exports.get'>): void {
    const access = requireSession(context.security);
    assertExportWork(work);
    if (work.scope !== access.scope.id || work.authorization.actor !== access.actor.id || work.authorization.membership !== access.actor.membership)
      throw new DomainError('AUTHORIZATION_DENIED');
  }
  private assertAssurance(work: RuntimeExportWork, context: PrepareContext<'voucher.exports.get'>): void {
    const access = requireSession(context.security);
    const definition = OperationCatalog.get(String(work.authorization.operation));
    const minimum = definition.assuranceLevel === 'stepup' ? 3 : definition.assuranceLevel === 'mfa' ? 2 : 1;
    if (access.assurance.level < minimum || !this.stepup.accepts(minimum === 3, access.assurance, new Date())) throw new DomainError('STEPUP_REQUIRED');
  }
}

function downloadSeconds(record: RuntimeExportRecord): number {
  const remaining = Math.floor((Date.parse(record.expiresAt) - Date.now()) / 1_000);
  return Number.isFinite(remaining) ? Math.min(RUNTIME_LIMITS.voucherExport.downloadTtlSeconds, remaining) : 0;
}
