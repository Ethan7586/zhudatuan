import { randomUUID } from 'node:crypto';
import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { CommitContext, FinalizeContext, PrepareContext } from '../../../../foundation/application/HandlerContext';
import type { JobScheduler } from '../../../../foundation/application/JobScheduler';
import type { DurableOperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import { DomainError } from '../../../../foundation/domain/DomainError';
import { bodyRecord } from '../../../../foundation/application/Validation';
import { authorizationEvidence } from '../../../../foundation/security/AuthorizationEvidence';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
import type { ImportObjectPort, ImportPort } from '../../../runtime/public';
import { statementImportMetadata, type StatementImportMetadata } from '../../domain/value/StatementImport';
import type { FinanceChannelPort } from '../../../channel/public';
import type { OrganizationReadPort } from '../../../organization/public';

interface PreparedImport {
  readonly scope: string;
  readonly reference: string;
  readonly sha256: string;
  readonly name: string;
  readonly mediaType: string;
  readonly size: number;
  readonly metadata: StatementImportMetadata;
}

export class ImportsCreateHandler implements DurableOperationHandler<'finance.statementimports.create', PreparedImport, OperationOutputFor<'finance.statementimports.create'>, 'write'> {
  readonly operation = 'finance.statementimports.create' as const;
  readonly mode = 'write' as const;

  constructor(
    private readonly imports: ImportPort,
    private readonly jobs: JobScheduler,
    private readonly objects: ImportObjectPort,
    private readonly organizations: Pick<OrganizationReadPort, 'descendants'>,
    private readonly channels: Pick<FinanceChannelPort, 'importProviders'>
  ) {}

  async prepare(input: OperationInputFor<'finance.statementimports.create'>, context: PrepareContext<'finance.statementimports.create'>): Promise<PreparedImport> {
    const access = requireSession(context.security);
    let metadata: StatementImportMetadata;
    try {
      metadata = statementImportMetadata(bodyRecord(input));
    } catch (cause) {
      const reason = cause instanceof Error ? cause.message : 'FINANCE_IMPORT_METADATA_INVALID';
      throw new DomainError('VALIDATION_FAILED', { field: reason });
    }
    const object = await this.objects.prepare(input, access.scope.tenant ?? access.organization);
    return Object.freeze({ scope: access.scope.id, reference: object.reference, sha256: object.sha256, name: object.name,
      mediaType: object.mediaType, size: object.size, metadata });
  }

  async commit(_input: OperationInputFor<'finance.statementimports.create'>, prepared: PreparedImport, context: CommitContext<'finance.statementimports.create'>) {
    const access = requireSession(context.security);
    const scopes = await this.organizations.descendants(context.transaction, access.scope.id);
    const providers = await this.channels.importProviders(context.transaction, scopes);
    if (!providers.some(({ id }) => id === prepared.metadata.provider)) {
      throw new DomainError('VALIDATION_FAILED', { field: 'provider', reason: 'CHANNEL_PROVIDER_UNAVAILABLE' });
    }
    const id = `import:${randomUUID()}`;
    const record = await this.imports.create(context.transaction, {
      id,
      scope: prepared.scope,
      owner: 'finance',
      kind: 'statement',
      reference: prepared.reference,
      sha256: prepared.sha256,
      name: prepared.name,
      mediaType: prepared.mediaType,
      size: prepared.size,
      actor: access.actor.id,
      authorization: authorizationEvidence(access, this.operation, new Date()),
      metadata: prepared.metadata,
    });
    await this.jobs.schedule(context.transaction, {
      id: `job:${id}:0`,
      kind: 'financeimport',
      owner: 'finance',
      scope: prepared.scope,
      payload: { import: id },
      priority: 100,
    });
    const response = { status: 202, body: record as OperationOutputFor<'finance.statementimports.create'> } as const;
    return Object.freeze({ checkpoint: response.body, response });
  }

  finalize(
    _input: OperationInputFor<'finance.statementimports.create'>,
    checkpoint: OperationOutputFor<'finance.statementimports.create'>,
    _context: FinalizeContext<'finance.statementimports.create'>
  ): Promise<OperationReply<OperationOutputFor<'finance.statementimports.create'>>> {
    return Promise.resolve({ status: 202, body: checkpoint });
  }
}
