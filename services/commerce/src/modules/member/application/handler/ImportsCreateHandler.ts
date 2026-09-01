import { randomUUID } from 'node:crypto';
import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import { ImportObjectService } from '../../../../foundation/application/ImportObjectService';
import type { CommitContext, FinalizeContext, PrepareContext } from '../../../../foundation/application/HandlerContext';
import type { JobScheduler } from '../../../../foundation/application/JobScheduler';
import type { DurableOperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
import type { MemberRepository } from '../port/MemberRepository';

interface PreparedImport {
  readonly organization: string;
  readonly reference: string;
  readonly sha256: string;
}

export class ImportsCreateHandler implements DurableOperationHandler<'member.imports.create', PreparedImport, OperationOutputFor<'member.imports.create'>, 'write'> {
  readonly operation = 'member.imports.create' as const;
  readonly mode = 'write' as const;
  constructor(
    private readonly members: MemberRepository,
    private readonly jobs: JobScheduler,
    private readonly objects: ImportObjectService
  ) {}

  async prepare(input: OperationInputFor<'member.imports.create'>, context: PrepareContext<'member.imports.create'>): Promise<PreparedImport> {
    const access = requireSession(context.security);
    return Object.freeze({ organization: access.scope.id, ...(await this.objects.prepare(input)) });
  }

  async commit(_input: OperationInputFor<'member.imports.create'>, prepared: PreparedImport, context: CommitContext<'member.imports.create'>) {
    const id = `memberimport:${randomUUID()}`;
    const body = await this.members.createImport(context.transaction, { id, organization: prepared.organization, reference: prepared.reference, sha256: prepared.sha256 });
    await this.jobs.schedule(context.transaction, { id: `job:${id}:0`, kind: 'memberimport', owner: 'member', scope: prepared.organization, payload: { import: id }, priority: 100 });
    const response = { status: 202, body: body as OperationOutputFor<'member.imports.create'> } as const;
    return Object.freeze({ checkpoint: response.body, response });
  }

  finalize(
    _input: OperationInputFor<'member.imports.create'>,
    checkpoint: OperationOutputFor<'member.imports.create'>,
    _context: FinalizeContext<'member.imports.create'>
  ): Promise<OperationReply<OperationOutputFor<'member.imports.create'>>> {
    return Promise.resolve({ status: 202, body: checkpoint });
  }
}
