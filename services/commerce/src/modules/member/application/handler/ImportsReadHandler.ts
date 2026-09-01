import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import { DomainError } from '../../../../foundation/domain/DomainError';
import type { FinalizeContext, HandlerContext, PrepareContext } from '../../../../foundation/application/HandlerContext';
import type { DurableOperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import type { ObjectStore } from '../../../../foundation/infrastructure/ObjectStore';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
import type { ImportRecord, MemberRepository } from '../port/MemberRepository';

export class ImportsReadHandler implements DurableOperationHandler<'member.imports.read', undefined, ImportRecord, 'read'> {
  readonly operation = 'member.imports.read' as const;
  readonly mode = 'read' as const;
  constructor(
    private readonly members: MemberRepository,
    private readonly objects: ObjectStore
  ) {}

  prepare(_input: OperationInputFor<'member.imports.read'>, _context: PrepareContext<'member.imports.read'>): Promise<undefined> {
    return Promise.resolve(undefined);
  }

  async commit(input: OperationInputFor<'member.imports.read'>, _prepared: undefined, context: HandlerContext<'member.imports.read'>) {
    const access = requireSession(context.security);
    const record = await this.members.readImport(context.transaction, input.path.importid, access.scope.id);
    if (!record) throw new DomainError('RESOURCE_NOT_FOUND');
    return Object.freeze({ checkpoint: record, response: { status: 200, body: withoutReport(record) as OperationOutputFor<'member.imports.read'> } as const });
  }

  async finalize(_input: OperationInputFor<'member.imports.read'>, checkpoint: ImportRecord, _context: FinalizeContext<'member.imports.read'>): Promise<OperationReply<OperationOutputFor<'member.imports.read'>>> {
    const body = withoutReport(checkpoint);
    if (checkpoint.reportObjectRef === null) return { status: 200, body: body as OperationOutputFor<'member.imports.read'> };
    const download = await this.objects.authorize(checkpoint.reportObjectRef, 300);
    return { status: 200, body: { ...body, report: { sha256: checkpoint.reportSha256, size: checkpoint.reportSize, download } } as unknown as OperationOutputFor<'member.imports.read'> };
  }
}

function withoutReport(record: ImportRecord): Readonly<Record<string, unknown>> {
  const { report_object_ref: _reference, report_sha256: _sha256, report_size: _size, reportObjectRef: _camelReference, reportSha256: _camelSha256, reportSize: _camelSize, ...body } = record;
  return Object.freeze(body);
}
