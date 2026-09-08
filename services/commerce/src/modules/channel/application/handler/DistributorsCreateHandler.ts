import { randomUUID } from 'node:crypto';
import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { CommitContext, FinalizeContext, PrepareContext } from '../../../../pipeline/HandlerContext';
import type { DurableCommit, DurableOperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import { DomainError } from '../../../../platform/error/DomainError';
import type { CipherEnvelope, KmsClient } from '../../../../pipeline/KmsPort';
import { bodyRecord, nullableText, textField } from '../../../../pipeline/Validation';
import { requireSession } from '../../../../platform/security/OperationSecurityContext';
import type { DistributorRepository } from '../port/DistributorRepository';

interface PreparedDistributor {
  readonly id: string;
  readonly scope: string;
  readonly code: string;
  readonly name: string;
  readonly timezone: string;
  readonly settlementMode: string;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly contact: CipherEnvelope | null;
}

export class DistributorsCreateHandler implements DurableOperationHandler<'channel.distributors.create', PreparedDistributor, Readonly<Record<string, unknown>>, 'write'> {
  readonly operation = 'channel.distributors.create' as const;
  readonly mode = 'write' as const;
  constructor(
    private readonly distributors: DistributorRepository,
    private readonly kms: KmsClient
  ) {}

  async prepare(input: OperationInputFor<'channel.distributors.create'>, context: PrepareContext<'channel.distributors.create'>): Promise<PreparedDistributor> {
    const access = requireSession(context.security);
    const body = bodyRecord(input);
    const id = `distributor:${randomUUID()}`;
    const contact = nullableText(body, 'contact');
    const envelope = contact === null ? null : await this.kms.encrypt('pii', 'channel/contact', contact, { distributor: id, scope: access.scope.id });
    return Object.freeze({
      id,
      scope: access.scope.id,
      code: textField(body, 'code', 64),
      name: textField(body, 'name'),
      timezone: nullableText(body, 'timezone') ?? 'Asia/Shanghai',
      settlementMode: textField(body, 'settlementMode', 64),
      metadata: record(body.metadata),
      contact: envelope,
    });
  }

  async commit(
    _input: OperationInputFor<'channel.distributors.create'>,
    prepared: PreparedDistributor,
    context: CommitContext<'channel.distributors.create'>
  ): Promise<DurableCommit<Readonly<Record<string, unknown>>, OperationOutputFor<'channel.distributors.create'>>> {
    const created = await this.distributors.create(context.transaction, prepared);
    return { checkpoint: created, response: { status: 201, body: created as OperationOutputFor<'channel.distributors.create'> } };
  }

  async finalize(
    _input: OperationInputFor<'channel.distributors.create'>,
    checkpoint: Readonly<Record<string, unknown>>,
    _context: FinalizeContext<'channel.distributors.create'>
  ): Promise<OperationReply<OperationOutputFor<'channel.distributors.create'>>> {
    return { status: 201, body: checkpoint as OperationOutputFor<'channel.distributors.create'> };
  }
}

function record(value: unknown): Readonly<Record<string, unknown>> {
  if (value === undefined || value === null) return Object.freeze({});
  if (typeof value !== 'object' || Array.isArray(value)) throw new DomainError('VALIDATION_FAILED', { field: 'metadata' });
  return Object.freeze({ ...(value as Record<string, unknown>) });
}
